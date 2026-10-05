import mongoose from 'mongoose';
import { leadRepository } from './lead.repository.js';
import { normalizePhone, normalizeEmail } from '../../shared/utils/normalize.js';
import { AppError } from '../../shared/errors/AppError.js';
import { eventBus } from '../../shared/events/EventBus.js';
import { ILead, LeadModel, LeadScoreCategory, SlaStatus } from './lead.model.js';
import { UserModel } from '../auth/auth.model.js';
import { callRepository } from '../calls/call.repository.js';
import { taskRepository } from '../tasks/task.repository.js';
import { dealRepository } from '../deals/deal.repository.js';
import { USER_ROLES, UserRole } from '../../config/constants.js';
import { AuthenticatedUser } from '../../middleware/auth.middleware.js';
import { InvoiceModel } from '../invoices-payments/invoice.model.js';

export class LeadService {
  /**
   * Compute initial AI/rule-based score based on signals
   */
  private calculateInitialScore(data: {
    source: string;
    budget?: number;
    requirement?: string;
  }): { score: number; scoreCategory: LeadScoreCategory } {
    let score = 50;

    if (data.source === 'INBOUND_CALL' || data.source === 'WEBSITE') {
      score += 20;
    } else if (data.source === 'META_ADS' || data.source === 'GOOGLE_ADS') {
      score += 15;
    } else if (data.source === 'REFERRAL') {
      score += 25;
    }

    if (data.budget && data.budget >= 50000) {
      score += 20;
    } else if (data.budget && data.budget >= 10000) {
      score += 10;
    }

    if (data.requirement && data.requirement.length > 30) {
      score += 10;
    }

    score = Math.min(100, Math.max(0, score));
    let scoreCategory: LeadScoreCategory = 'WARM';
    if (score >= 75) scoreCategory = 'HOT';
    else if (score < 40) scoreCategory = 'COLD';

    return { score, scoreCategory };
  }

  /**
   * Automatically select next sales rep via round-robin
   */
  private async getNextRoundRobinOwner(organizationId: string): Promise<{
    id: string;
    name: string;
    avatarUrl?: string;
  } | null> {
    const salesReps = await UserModel.find({
      organizationId,
      role: { $in: [USER_ROLES.SALES_REP, USER_ROLES.TELECALLER] },
      isActive: true,
    })
      .sort({ updatedAt: 1 })
      .limit(1)
      .lean();

    if (salesReps.length > 0) {
      const rep = salesReps[0];
      // Touch updatedAt to rotate
      await UserModel.updateOne({ _id: rep._id }, { $set: { updatedAt: new Date() } });
      return {
        id: rep._id.toString(),
        name: rep.name,
        avatarUrl: rep.avatarUrl,
      };
    }

    return null;
  }

  /**
   * Create or capture a new lead with deduplication check
   */
  async createLead(
    organizationId: string,
    leadData: Partial<ILead> & { name: string; phone: string }
  ): Promise<ILead> {
    const normalizedPhone = normalizePhone(leadData.phone);
    const normalizedEmail = leadData.email ? normalizeEmail(leadData.email) : undefined;

    // Deduplication check
    const existing = await leadRepository.findDuplicate(
      organizationId,
      normalizedPhone,
      normalizedEmail
    );

    if (existing) {
      throw AppError.conflict(
        `A lead with phone (${leadData.phone}) or email (${leadData.email}) already exists in this workspace [${existing.leadId}]`
      );
    }

    const leadId = await leadRepository.generateLeadId(organizationId);
    const { score, scoreCategory } = this.calculateInitialScore({
      source: leadData.source || 'MANUAL',
      budget: leadData.budget,
      requirement: leadData.requirement,
    });

    // Assignment only if owner explicitly provided
    let assignedTo = leadData.assignedTo;
    let ownerId = leadData.ownerId;
    let status = leadData.status || (ownerId ? 'ASSIGNED' : 'NEW');

    const createdLead = await leadRepository.create(organizationId, {
      ...leadData,
      leadId,
      normalizedPhone,
      normalizedEmail,
      score,
      scoreCategory,
      status,
      ownerId,
      assignedTo,
      slaStatus: 'ON_TIME',
    });

    // Emit event for automation engine / notifications
    eventBus.emit('lead.created', {
      organizationId,
      leadId: createdLead.leadId,
      source: createdLead.source,
      score: createdLead.score,
      ownerId: createdLead.ownerId,
    });

    return createdLead;
  }

  /**
   * Query paginated leads with filters and search
   */
  async getLeads(
    organizationId: string,
    query: {
      page?: number;
      limit?: number;
      status?: string;
      ownerId?: string;
      source?: string;
      search?: string;
      scoreCategory?: LeadScoreCategory;
      slaStatus?: SlaStatus;
    },
    requestingUser?: AuthenticatedUser
  ) {
    const filter: Record<string, unknown> = {};

    if (query.status) filter.status = query.status;
    if (query.ownerId) {
      if (query.ownerId === 'UNASSIGNED') {
        filter.$or = [
          { ownerId: { $exists: false } },
          { ownerId: null },
          { ownerId: '' },
          { status: 'NEW' },
        ];
      } else {
        filter.ownerId = query.ownerId;
      }
    }
    if (query.source) filter.source = query.source;
    if (query.scoreCategory) filter.scoreCategory = query.scoreCategory;
    if (query.slaStatus) filter.slaStatus = query.slaStatus;
    const teamLeadRoles: UserRole[] = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ORG_ADMIN];
    const canViewTeamLeads = requestingUser && teamLeadRoles.includes(requestingUser.role);
    if (requestingUser && !canViewTeamLeads) {
      const empOr = [
        { ownerId: requestingUser.id },
        { 'assignedTo.id': requestingUser.id },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: empOr }];
        delete filter.$or;
      } else {
        filter.$or = empOr;
      }
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { name: searchRegex },
        { company: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { leadId: searchRegex },
      ];
    }

    return leadRepository.findPaginated(organizationId, filter, {
      page: query.page,
      limit: query.limit,
      sort: { createdAt: -1 },
    });
  }

  /**
   * Get single lead by ID
   */
  async getLeadById(organizationId: string, id: string): Promise<ILead> {
    const lead = await leadRepository.findById(organizationId, id);
    if (!lead) {
      throw AppError.notFound('Lead');
    }
    return lead;
  }

  /**
   * Update lead fields with lifecycle event emission
   */
  async updateLead(organizationId: string, id: string, updateData: Partial<ILead>): Promise<ILead> {
    const existing = await leadRepository.findById(organizationId, id);
    if (!existing) {
      throw AppError.notFound('Lead');
    }

    if (updateData.phone) {
      updateData.normalizedPhone = normalizePhone(updateData.phone);
    }
    if (updateData.email) {
      updateData.normalizedEmail = normalizeEmail(updateData.email);
    }

    const updated = await leadRepository.updateById(organizationId, id, updateData);
    if (!updated) {
      throw AppError.notFound('Lead');
    }

    // If status changed, emit lifecycle event
    if (updateData.status && updateData.status !== existing.status) {
      eventBus.emit('lead.status_changed', {
        organizationId,
        leadId: updated.leadId,
        previousStatus: existing.status,
        newStatus: updateData.status,
      });
    }

    return updated;
  }

  /**
   * Delete lead by ID
   */
  private buildDeleteQuery(
    organizationId: string,
    filter: {
      leadIds?: string[];
      status?: string;
      statuses?: string[];
      employeeId?: string;
      unassignedOnly?: boolean;
      all?: boolean;
    }
  ): Record<string, unknown> {
    const query: Record<string, unknown> = { organizationId };

    if (filter.all) {
      return query;
    }

    if (filter.leadIds && filter.leadIds.length > 0) {
      const validObjectIds = filter.leadIds
        .filter((id) => mongoose.isValidObjectId(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      query.$or = [
        { _id: { $in: validObjectIds } },
        { leadId: { $in: filter.leadIds } },
        { id: { $in: filter.leadIds } },
      ];
      return query;
    }

    // Status filter
    if (filter.statuses && filter.statuses.length > 0) {
      query.status = { $in: filter.statuses };
    } else if (filter.status) {
      if (filter.status === 'ALL_COMPLETED') {
        query.status = { $in: ['WON', 'LOST', 'CONVERTED', 'UNQUALIFIED'] };
      } else if (filter.status !== 'ALL') {
        query.status = filter.status;
      }
    }

    // Employee filter (so employee's dashboard is completely cleaned up)
    if (filter.employeeId && filter.employeeId !== 'ALL') {
      const empOr = [
        { ownerId: filter.employeeId },
        { 'assignedTo.id': filter.employeeId },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: empOr }];
        delete query.$or;
      } else {
        query.$or = empOr;
      }
    }

    // Unassigned filter
    if (filter.unassignedOnly) {
      const unassignedOr = [
        { ownerId: { $exists: false } },
        { ownerId: null },
        { ownerId: '' },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: unassignedOr }];
        delete query.$or;
      } else {
        query.$or = unassignedOr;
      }
    }

    return query;
  }

  private async getDeletableLeads(query: Record<string, unknown>): Promise<{
    deletableIds: mongoose.Types.ObjectId[];
    matchedCount: number;
  }> {
    const [deletableLeads, matchedCount] = await Promise.all([
      LeadModel.aggregate<{ _id: mongoose.Types.ObjectId }>([
        {
          $match: {
            $and: [
              query,
              { $expr: { $eq: [{ $size: { $ifNull: ['$queries', []] } }, 0] } },
            ],
          },
        },
        {
          $lookup: {
            from: InvoiceModel.collection.name,
            let: { leadObjectId: { $toString: '$_id' }, leadOrganizationId: '$organizationId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$organizationId', '$$leadOrganizationId'] },
                      { $eq: ['$leadId', '$$leadObjectId'] },
                      { $eq: ['$status', 'PAID'] },
                    ],
                  },
                },
              },
              { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
            ],
            as: 'paidInvoices',
          },
        },
        {
          $addFields: {
            _deletionTotalAmount: {
              $ifNull: ['$clearedInfo.dealValue', { $ifNull: ['$budget', 0] }],
            },
            _deletionPaidAmount: {
              $max: [
                { $ifNull: ['$clearedInfo.paymentTotalPaid', 0] },
                { $ifNull: [{ $arrayElemAt: ['$paidInvoices.totalPaid', 0] }, 0] },
              ],
            },
            _deletionIsFinalized: {
              $or: [
                { $ne: [{ $ifNull: ['$clearedInfo.clearedAt', null] }, null] },
                { $in: ['$status', ['WON', 'CONVERTED']] },
              ],
            },
          },
        },
        {
          $match: {
            $expr: {
              $not: [
                {
                  $and: [
                    '$_deletionIsFinalized',
                    { $gt: ['$_deletionTotalAmount', 0] },
                    { $gt: ['$_deletionTotalAmount', '$_deletionPaidAmount'] },
                  ],
                },
              ],
            },
          },
        },
        { $project: { _id: 1 } },
      ]),
      LeadModel.countDocuments(query),
    ]);

    return {
      deletableIds: deletableLeads.map((lead) => lead._id),
      matchedCount,
    };
  }

  private getDeletionSafetyExpression(): Record<string, unknown> {
    const totalAmount = {
      $ifNull: ['$clearedInfo.dealValue', { $ifNull: ['$budget', 0] }],
    };
    const isFinalized = {
      $or: [
        { $ne: [{ $ifNull: ['$clearedInfo.clearedAt', null] }, null] },
        { $in: ['$status', ['WON', 'CONVERTED']] },
      ],
    };

    return {
      $and: [
        { $eq: [{ $size: { $ifNull: ['$queries', []] } }, 0] },
        {
          $not: [
            {
              $and: [
                isFinalized,
                { $gt: [totalAmount, 0] },
                { $gt: [totalAmount, { $ifNull: ['$clearedInfo.paymentTotalPaid', 0] }] },
              ],
            },
          ],
        },
      ],
    };
  }

  async getBulkDeleteCount(
    organizationId: string,
    filter: {
      leadIds?: string[];
      status?: string;
      statuses?: string[];
      employeeId?: string;
      unassignedOnly?: boolean;
      all?: boolean;
    }
  ): Promise<{ count: number; protectedCount: number }> {
    const query = this.buildDeleteQuery(organizationId, filter);
    const { deletableIds, matchedCount } = await this.getDeletableLeads(query);
    return {
      count: deletableIds.length,
      protectedCount: matchedCount - deletableIds.length,
    };
  }

  async bulkDeleteLeads(
    organizationId: string,
    filter: {
      leadIds?: string[];
      status?: string;
      statuses?: string[];
      employeeId?: string;
      unassignedOnly?: boolean;
      all?: boolean;
    }
  ): Promise<{ deletedCount: number; protectedCount: number }> {
    const query = this.buildDeleteQuery(organizationId, filter);
    const { deletableIds, matchedCount } = await this.getDeletableLeads(query);
    const result = deletableIds.length > 0
      ? await LeadModel.deleteMany({
          organizationId,
          _id: { $in: deletableIds },
          $expr: this.getDeletionSafetyExpression(),
        })
      : { deletedCount: 0 };
    if (result.deletedCount > 0) {
      eventBus.emit('lead.deleted', { organizationId, deletedCount: result.deletedCount });
    }
    return {
      deletedCount: result.deletedCount,
      protectedCount: matchedCount - deletableIds.length,
    };
  }

  async deleteLead(organizationId: string, id: string): Promise<void> {
    const query = this.buildDeleteQuery(organizationId, { leadIds: [id] });
    const { deletableIds, matchedCount } = await this.getDeletableLeads(query);
    if (matchedCount === 0) {
      throw AppError.notFound('Lead');
    }
    if (deletableIds.length === 0) {
      throw AppError.conflict('This lead cannot be deleted because it has query history or an outstanding payment balance.');
    }

    const deleted = await LeadModel.deleteOne({
      organizationId,
      _id: deletableIds[0],
      $expr: this.getDeletionSafetyExpression(),
    });
    if (deleted.deletedCount === 0) {
      throw AppError.conflict('This lead changed and can no longer be deleted safely. Refresh and try again.');
    }
    eventBus.emit('lead.deleted', { organizationId, deletedCount: 1 });
  }

  /**
   * Aggregate pipeline status metrics
   */
  async getMetrics(organizationId: string): Promise<Record<string, number>> {
    return leadRepository.getStatusMetrics(organizationId);
  }

  private async findLeadDoc(organizationId: string, leadId: string): Promise<ILead | null> {
    const conditions: any[] = [{ leadId }];
    if (mongoose.Types.ObjectId.isValid(leadId)) {
      conditions.push({ _id: new mongoose.Types.ObjectId(leadId) });
      conditions.push({ _id: leadId });
    } else {
      conditions.push({ _id: leadId });
    }
    return await LeadModel.findOne({
      organizationId,
      $or: conditions,
    });
  }

  async raiseQuery(
    organizationId: string,
    leadId: string,
    user: { id: string; name: string; email?: string },
    payload: { text: string; priority?: 'NORMAL' | 'HIGH' | 'URGENT' }
  ): Promise<ILead> {
    const lead = await this.findLeadDoc(organizationId, leadId);
    if (!lead) throw AppError.notFound('Lead');

    const queryItem = {
      id: `qry_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      text: payload.text,
      priority: payload.priority || ('NORMAL' as const),
      raisedBy: { id: user.id, name: user.name, email: user.email },
      status: 'OPEN' as const,
      createdAt: new Date(),
    };

    if (!lead.queries) lead.queries = [];
    lead.queries.push(queryItem);
    await lead.save();

    (eventBus as any).emit('lead.query_raised', {
      organizationId,
      leadId: lead.leadId,
      queryId: queryItem.id,
      raisedBy: user.name,
      text: payload.text,
    });

    return lead;
  }

  async resolveQuery(
    organizationId: string,
    leadId: string,
    queryId: string,
    reply?: string,
    user?: { id: string; name: string }
  ): Promise<ILead> {
    const lead = await this.findLeadDoc(organizationId, leadId);
    if (!lead) throw AppError.notFound('Lead');

    const query = lead.queries?.find((q) => q.id === queryId);
    if (!query) throw AppError.notFound('Query');

    query.status = 'RESOLVED';
    if (reply) query.reply = reply;
    query.resolvedAt = new Date();

    await lead.save();

    (eventBus as any).emit('lead.query_resolved', {
      organizationId,
      leadId: lead.leadId,
      queryId,
      resolvedBy: user?.name,
    });

    return lead;
  }

  async getAllLeadQueries(organizationId: string) {
    const leadsWithQueries = await LeadModel.find({
      organizationId,
      'queries.0': { $exists: true },
    })
      .select('name company phone email address city customFields status assignedTo ownerId queries leadId')
      .lean();

    const flattenedQueries: any[] = [];
    for (const lead of leadsWithQueries) {
      if (lead.queries && Array.isArray(lead.queries)) {
        const address =
          (lead as any).address ||
          (lead as any).city ||
          (lead as any).customFields?.['Address'] ||
          (lead as any).customFields?.['address'] ||
          (lead as any).customFields?.['City'] ||
          (lead as any).customFields?.['city'] ||
          (lead as any).customFields?.['Location'] ||
          (lead as any).customFields?.['location'] ||
          (lead as any).customFields?.['Area'] ||
          (lead as any).customFields?.['State'] ||
          '';

        for (const q of lead.queries) {
          flattenedQueries.push({
            ...q,
            leadId: (lead as any)._id?.toString() || (lead as any).id,
            leadCode: lead.leadId,
            leadName: lead.name,
            leadCompany: lead.company,
            leadPhone: lead.phone,
            leadEmail: lead.email,
            leadCity: (lead as any).city || '',
            leadAddress: address,
            leadStatus: lead.status,
            assignedTo: lead.assignedTo,
          });
        }
      }
    }

    flattenedQueries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return flattenedQueries;
  }

  async completeLead(
    organizationId: string,
    leadId: string,
    user: { id: string; name: string },
    payload: {
      purpose: string;
      dealValue?: number;
      status?: string;
      notes?: string;
    }
  ): Promise<ILead> {
    const lead = await this.findLeadDoc(organizationId, leadId);
    if (!lead) throw AppError.notFound('Lead');

    lead.status = (payload.status as any) || 'WON';
    const finalMsg = payload.notes?.trim() || payload.purpose;
    lead.clearedInfo = {
      clearedAt: new Date(),
      purpose: payload.purpose,
      notes: payload.notes?.trim() || '',
      message: finalMsg,
      dealValue: payload.dealValue !== undefined ? payload.dealValue : (lead.budget || 0),
      clearedBy: {
        id: user.id,
        name: user.name,
      },
    };

    await lead.save();

    try {
      const dealVal = payload.dealValue !== undefined ? payload.dealValue : ((lead as any).estimatedValue || lead.budget || 0);
      const dealId = await dealRepository.generateDealId(organizationId);

      const createdDeal = await dealRepository.create(organizationId, {
        dealId,
        title: `${lead.company || lead.name} - Finalized Deal`,
        company: lead.company || 'Enterprise Client',
        contactName: lead.name,
        contactEmail: lead.email,
        contactPhone: lead.phone,
        contactAddress: lead.address || lead.city || '',
        value: dealVal,
        currency: 'INR',
        stage: 'WON',
        pipelineId: 'pipe_default',
        probability: 100,
        expectedCloseDate: new Date(),
        ownerId: user.id,
        assignedTo: {
          id: user.id,
          name: user.name,
        },
        health: 'HEALTHY',
        leadId: (lead as any)._id?.toString() || lead.leadId,
        notes: finalMsg,
        transitions: [
          {
            toStage: 'WON',
            actorId: user.id,
            reason: `Finalized by ${user.name}. Purpose: ${payload.purpose}. Message: ${finalMsg}`,
            transitionedAt: new Date(),
          },
        ],
      });

      lead.clearedInfo.dealId = createdDeal.dealId;
      await lead.save();
    } catch (dealErr) {
      console.warn('Could not auto-create deal for finalized lead:', dealErr);
    }

    try {
      const taskId = await taskRepository.generateTaskId(organizationId);
      await taskRepository.create(organizationId, {
        taskId,
        title: `Finalized Lead: ${lead.name} (${lead.company})`,
        relatedTo: {
          type: 'LEAD',
          id: (lead as any)._id?.toString() || lead.leadId,
          name: `${lead.name} [Purpose: ${payload.purpose}]`,
        },
        ownerId: user.id,
        assignedToName: user.name,
        priority: 'HIGH',
        dueAt: new Date(),
        status: 'COMPLETED',
        isCompleted: true,
        completedAt: new Date(),
        notes: `Purpose: ${payload.purpose}${payload.dealValue ? ` | Final Deal Value: ₹${payload.dealValue.toLocaleString()}` : ''}${payload.notes ? ` | Notes: ${payload.notes}` : ''}`,
      });
    } catch {
      // non-fatal
    }

    (eventBus as any).emit('lead.completed', {
      organizationId,
      leadId: lead.leadId,
      completedBy: user.name,
      purpose: payload.purpose,
      message: finalMsg,
      dealValue: lead.clearedInfo.dealValue,
    });

    return lead;
  }

  async getFinalizedLeads(organizationId: string, employeeId?: string) {
    const ownershipFilter = employeeId
      ? { 'clearedInfo.clearedBy.id': employeeId }
      : {};
    const leads = await LeadModel.find({
      organizationId,
      ...ownershipFilter,
      $or: [
        { 'clearedInfo.clearedAt': { $exists: true } },
        { status: { $in: ['WON', 'CONVERTED'] } },
      ],
    })
      .sort({ 'clearedInfo.clearedAt': -1, updatedAt: -1 })
      .lean();

    const leadIds = leads.map((lead) => lead._id.toString());
    const paymentTotals = leadIds.length
      ? await InvoiceModel.aggregate<{ _id: string; totalPaid: number }>([
          {
            $match: {
              organizationId,
              leadId: { $in: leadIds },
              status: 'PAID',
            },
          },
          { $group: { _id: '$leadId', totalPaid: { $sum: '$amount' } } },
        ])
      : [];
    const paidByLeadId = new Map(paymentTotals.map(({ _id, totalPaid }) => [_id, totalPaid]));

    return leads.map((l: any) => {
      const address =
        l.address ||
        l.city ||
        l.customFields?.['Address'] ||
        l.customFields?.['address'] ||
        l.customFields?.['City'] ||
        l.customFields?.['city'] ||
        l.customFields?.['Location'] ||
        l.customFields?.['location'] ||
        l.customFields?.['Area'] ||
        l.customFields?.['State'] ||
        '';

      const employeeMsg =
        l.clearedInfo?.notes ||
        l.clearedInfo?.message ||
        l.clearedInfo?.purpose ||
        'Lead successfully marked as WON by employee.';

      return {
        id: l._id?.toString() || l.id,
        leadId: l.leadId,
        name: l.name,
        company: l.company,
        phone: l.phone,
        email: l.email,
        city: l.city || '',
        address,
        status: l.status,
        assignedTo: l.assignedTo,
        ownerId: l.ownerId,
        budget: l.budget,
        notes: employeeMsg,
        message: employeeMsg,
        clearedInfo: {
          clearedAt: l.clearedInfo?.clearedAt || l.updatedAt || l.createdAt,
          purpose: l.clearedInfo?.purpose || 'Lead marked WON',
          notes: l.clearedInfo?.notes || '',
          message: employeeMsg,
          dealValue: l.clearedInfo?.dealValue !== undefined ? l.clearedInfo.dealValue : (l.budget || 0),
          clearedBy: l.clearedInfo?.clearedBy || (l.assignedTo ? { id: l.assignedTo.id, name: l.assignedTo.name } : undefined),
          paymentInvoiceId: l.clearedInfo?.paymentInvoiceId,
          paymentRecordedAt: l.clearedInfo?.paymentRecordedAt,
          paymentTotalPaid: Math.max(
            l.clearedInfo?.paymentTotalPaid || 0,
            paidByLeadId.get(l._id.toString()) || 0
          ),
        },
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      };
    });
  }

  async getEmployeeLeadStats(organizationId: string) {
    const employees = await UserModel.find({
      organizationId,
      role: { $in: [USER_ROLES.SALES_REP, USER_ROLES.TELECALLER, USER_ROLES.SALES_MANAGER, USER_ROLES.MARKETING_SDR] },
      isActive: true,
    })
      .select('name email role avatarUrl department phone')
      .lean();

    const stats = await Promise.all(
      employees.map(async (emp: any) => {
        const empId = emp._id.toString();
        const empName = emp.name;

        const empQuery = {
          organizationId,
          $or: [
            { ownerId: empId },
            { 'assignedTo.id': empId },
            { 'assignedTo.name': empName },
          ],
        };

        const totalAssigned = await LeadModel.countDocuments(empQuery);

        const completedCount = await LeadModel.countDocuments({
          ...empQuery,
          $or: [
            { status: { $in: ['WON', 'CONVERTED'] } },
            { 'clearedInfo.clearedAt': { $exists: true } },
          ],
        });

        const openQueriesCount = await LeadModel.countDocuments({
          ...empQuery,
          queries: { $elemMatch: { status: 'OPEN' } },
        });

        const inProgressCount = Math.max(0, totalAssigned - completedCount);
        const conversionRate = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;

        return {
          employeeId: empId,
          name: emp.name,
          email: emp.email,
          role: emp.role,
          avatarUrl: emp.avatarUrl,
          totalAssigned,
          completedCount,
          openQueriesCount,
          inProgressCount,
          conversionRate,
        };
      })
    );

    return stats;
  }
}

export const leadService = new LeadService();
