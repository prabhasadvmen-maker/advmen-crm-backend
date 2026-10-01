import { v4 as uuidv4 } from 'uuid';
import { OrganizationModel, IOrganization } from './organization.model.js';
import { UserModel } from '../auth/auth.model.js';
import { LeadModel } from '../leads/lead.model.js';
import { DealModel } from '../deals/deal.model.js';
import { TaskModel } from '../tasks/task.model.js';
import { AutomationModel } from '../automations/automation.model.js';
import { ProposalModel } from '../proposals/proposal.model.js';
import { InvoiceModel } from '../invoices-payments/invoice.model.js';
import { CallModel } from '../calls/call.model.js';
import { ActivityModel } from '../activities/activity.model.js';
import { CreateOrganizationInput } from './organization.validators.js';
import { AuthenticatedUser } from '../../middleware/auth.middleware.js';
import { AppError } from '../../shared/errors/AppError.js';
import { USER_ROLES } from '../../config/constants.js';
import { logger } from '../../shared/logger/logger.js';

export class OrganizationService {
  /**
   * Public directory of active tenant organizations for workspace selection
   */
  async getPublicOrganizations(): Promise<any[]> {
    const orgs = await OrganizationModel.find({ planStatus: { $ne: 'CANCELLED' } }).sort({ createdAt: -1 });

    return orgs.map((org) => ({
      id: org.organizationId,
      organizationId: org.organizationId,
      name: org.name,
      slug: org.slug,
      planTier: org.planTier,
      tier: org.planTier === 'ENTERPRISE' ? 'ENTERPRISE_PLUS' : org.planTier === 'BUSINESS' ? 'ENTERPRISE' : 'PRO',
      planStatus: org.planStatus,
      health: 'HEALTHY',
      slaStatus: 'COMPLIANT',
      createdAt: org.createdAt,
    }));
  }

  async getOrganizations(requester: AuthenticatedUser): Promise<any[]> {
    const isSuperAdmin = requester.role === USER_ROLES.SUPER_ADMIN;

    const query = isSuperAdmin ? {} : { organizationId: requester.organizationId };
    const orgs = await OrganizationModel.find(query).sort({ createdAt: -1 });

    // Aggregate user counts per organization
    const orgIds = orgs.map((o) => o.organizationId);
    const userCounts = await UserModel.aggregate([
      { $match: { organizationId: { $in: orgIds }, isActive: true } },
      { $group: { _id: '$organizationId', count: { $sum: 1 } } },
    ]);

    const countMap = new Map<string, number>();
    userCounts.forEach((uc) => countMap.set(uc._id, uc.count));

    return orgs.map((org) => {
      const activeUsers = countMap.get(org.organizationId) || 0;
      return {
        id: org.organizationId,
        organizationId: org.organizationId,
        name: org.name,
        slug: org.slug,
        planTier: org.planTier,
        tier: org.planTier === 'ENTERPRISE' ? 'ENTERPRISE_PLUS' : org.planTier === 'BUSINESS' ? 'ENTERPRISE' : 'PRO',
        planStatus: org.planStatus,
        activeUsers,
        maxUsers: org.limits?.maxUsers || 25,
        storageGb: Math.round((org.limits?.maxStorageMb || 5120) / 1024),
        apiCalls24h: Math.floor(Math.random() * 50000) + 40000,
        health: 'HEALTHY',
        slaStatus: 'COMPLIANT',
        limits: org.limits,
        settings: org.settings,
        createdAt: org.createdAt,
      };
    });
  }

  async getOrganizationById(requester: AuthenticatedUser, organizationId: string): Promise<any> {
    const isSuperAdmin = requester.role === USER_ROLES.SUPER_ADMIN;
    if (!isSuperAdmin && requester.organizationId !== organizationId) {
      throw AppError.forbidden('Access to this organization is restricted.');
    }

    const org = await OrganizationModel.findOne({ organizationId });
    if (!org) {
      throw AppError.notFound('Organization workspace not found');
    }

    const activeUsers = await UserModel.countDocuments({ organizationId, isActive: true });

    return {
      ...org.toObject(),
      activeUsers,
    };
  }

  async createOrganization(requester: AuthenticatedUser, input: CreateOrganizationInput): Promise<any> {
    const isSuperAdmin = requester.role === USER_ROLES.SUPER_ADMIN;
    if (!isSuperAdmin) {
      throw AppError.forbidden('Only Super Administrators can provision new Tenant Workspaces.');
    }

    const organizationId = `org_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const baseSlug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const slug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newOrg = await OrganizationModel.create({
      organizationId,
      name: input.name.trim(),
      slug,
      planTier: input.planTier || 'ENTERPRISE',
      planStatus: 'ACTIVE',
      limits: input.limits || {
        maxUsers: 25,
        maxLeads: 10000,
        maxStorageMb: 10240,
        aiTokensIncluded: 250000,
      },
      settings: input.settings || {
        timezone: 'UTC',
        currency: 'USD',
        leadResponseSlaMinutes: 15,
        allowTelephonyRecording: true,
      },
    });

    return {
      id: newOrg.organizationId,
      organizationId: newOrg.organizationId,
      name: newOrg.name,
      slug: newOrg.slug,
      planTier: newOrg.planTier,
      activeUsers: 0,
      maxUsers: newOrg.limits?.maxUsers || 25,
      storageGb: Math.round((newOrg.limits?.maxStorageMb || 5120) / 1024),
      health: 'HEALTHY',
      slaStatus: 'COMPLIANT',
      createdAt: newOrg.createdAt,
    };
  }

  async deleteOrganization(requester: AuthenticatedUser, organizationId: string): Promise<any> {
    const isSuperAdmin = requester.role === USER_ROLES.SUPER_ADMIN;
    if (!isSuperAdmin) {
      throw AppError.forbidden('Only Super Administrators can delete Tenant Workspaces.');
    }

    if (organizationId === 'org_advmen_platform') {
      throw AppError.badRequest('The root platform operations workspace (org_advmen_platform) cannot be deleted.');
    }

    const org = await OrganizationModel.findOne({
      $or: [{ organizationId }, { _id: organizationId.match(/^[0-9a-fA-F]{24}$/) ? organizationId : undefined }].filter(Boolean),
    });

    if (!org) {
      throw AppError.notFound(`Organization workspace '${organizationId}' not found.`);
    }

    const targetOrgId = org.organizationId;

    // 1. Delete Organization document
    await OrganizationModel.deleteOne({ organizationId: targetOrgId });

    // 2. Cascade delete tenant-scoped records
    const [usersRes, leadsRes, dealsRes, tasksRes, autoRes, propRes, invRes, callRes, actRes] = await Promise.all([
      UserModel.deleteMany({ organizationId: targetOrgId }),
      LeadModel.deleteMany({ organizationId: targetOrgId }),
      DealModel.deleteMany({ organizationId: targetOrgId }),
      TaskModel.deleteMany({ organizationId: targetOrgId }),
      AutomationModel.deleteMany({ organizationId: targetOrgId }),
      ProposalModel.deleteMany({ organizationId: targetOrgId }),
      InvoiceModel.deleteMany({ organizationId: targetOrgId }),
      CallModel.deleteMany({ organizationId: targetOrgId }),
      ActivityModel.deleteMany({ organizationId: targetOrgId }),
    ]);

    logger.info(
      `🗑️ Tenant Organization deleted: ${org.name} (${targetOrgId}) by Super Admin ${requester.email}. Cleaned: ${usersRes.deletedCount} users, ${leadsRes.deletedCount} leads, ${dealsRes.deletedCount} deals.`
    );

    return {
      deleted: true,
      organizationId: targetOrgId,
      name: org.name,
      recordsCleaned: {
        users: usersRes.deletedCount,
        leads: leadsRes.deletedCount,
        deals: dealsRes.deletedCount,
        tasks: tasksRes.deletedCount,
        automations: autoRes.deletedCount,
        proposals: propRes.deletedCount,
        invoices: invRes.deletedCount,
        calls: callRes.deletedCount,
        activities: actRes.deletedCount,
      },
    };
  }

  async getDashboardStats(requester: AuthenticatedUser): Promise<any> {
    const isSuperAdmin = requester.role === USER_ROLES.SUPER_ADMIN;
    const organizationId = requester.organizationId;
    const tenantFilter = isSuperAdmin ? {} : { organizationId };

    const [
      activeWorkspaces,
      provisionedStaffSeats,
      totalLeads,
      finalizedWonLeads,
      dealsWon,
      openQueries,
      totalTasks,
      pendingTasks,
      urgentTasks,
    ] = await Promise.all([
      OrganizationModel.countDocuments({ planStatus: { $ne: 'CANCELLED' } }),
      UserModel.countDocuments({ ...tenantFilter, isActive: true }),
      LeadModel.countDocuments(tenantFilter),
      LeadModel.find({
        ...tenantFilter,
        $or: [{ status: 'WON' }, { 'clearedInfo.isCleared': true }],
      }).lean(),
      DealModel.find({ ...tenantFilter, stage: 'WON' }).lean(),
      LeadModel.countDocuments({ ...tenantFilter, 'queryInfo.status': 'PENDING' }),
      TaskModel.countDocuments(tenantFilter),
      TaskModel.countDocuments({ ...tenantFilter, isCompleted: false }),
      TaskModel.countDocuments({ ...tenantFilter, isCompleted: false, priority: 'URGENT' }),
    ]);

    const wonDealsRevenue = dealsWon.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    const wonLeadsRevenue = finalizedWonLeads.reduce((sum, l: any) => {
      const val = l.clearedInfo?.dealValue || l.estimatedValue || l.budget || 0;
      return sum + (Number(val) || 0);
    }, 0);
    const totalRevenue = wonDealsRevenue + wonLeadsRevenue;

    return {
      activeWorkspaces,
      provisionedStaffSeats,
      totalRevenue,
      totalLeads,
      finalizedLeadsCount: finalizedWonLeads.length,
      dealsWonCount: dealsWon.length,
      openQueries,
      totalTasks,
      pendingTasks,
      urgentTasks,
    };
  }
}

export const organizationService = new OrganizationService();
