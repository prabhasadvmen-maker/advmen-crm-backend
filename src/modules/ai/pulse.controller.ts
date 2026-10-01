import { Request, Response } from 'express';
import { PulseRulesEngine } from './pulse.rules.js';
import { generateAIDecision } from './pulse.service.js';
import { PulseDecisionModel } from './pulse.model.js';
import { TaskModel } from '../tasks/task.model.js';
import { AppError } from '../../shared/errors/AppError.js';
import { PulseIssueData, PulseBusinessContext } from './pulse.types.js';

export class PulseController {
  /**
   * GET /api/v1/ai/pulse/issues
   * Runs the deterministic rules engine on live MongoDB data to detect revenue leaks & issues
   */
  static async getDetectedIssues(req: Request, res: Response) {
    const user = (req as any).user;
    const organizationId = user?.organizationId || 'org_advmen_platform';

    const issues = await PulseRulesEngine.detectWorkspaceIssues(organizationId);

    // Also fetch any previously generated decisions for these issues
    const decisions = await PulseDecisionModel.find({ organizationId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return res.status(200).json({
      success: true,
      meta: {
        totalIssues: issues.length,
        organizationId,
        scannedAt: new Date().toISOString(),
      },
      issues,
      recentDecisions: decisions,
    });
  }

  /**
   * POST /api/v1/ai/pulse/decision
   * Synthesize context via OpenAI Structured Output into an actionable decision
   */
  static async createDecision(req: Request, res: Response) {
    const user = (req as any).user;
    const organizationId = user?.organizationId || 'org_advmen_platform';
    const { issueData, businessContext: customContext } = req.body as {
      issueData: PulseIssueData;
      businessContext?: Partial<PulseBusinessContext>;
    };

    if (!issueData || !issueData.issue_id) {
      throw AppError.badRequest('Missing issueData or issue_id in request body');
    }

    const businessContext: PulseBusinessContext = {
      organization_name: customContext?.organization_name || user?.organizationName || 'ADVMEN Platform',
      business_type: customContext?.business_type || 'B2B Services & SaaS',
      brand_tone: customContext?.brand_tone || 'PROFESSIONAL',
      escalation_tier: customContext?.escalation_tier || 1,
      payment_link_placeholder: customContext?.payment_link_placeholder || 'https://billing.advmen.com/pay',
    };

    // 1. Generate decision using OpenAI Structured Output / fallback
    const decision = await generateAIDecision(issueData, businessContext);

    // 2. Persist decision to MongoDB for human-in-the-loop review
    let savedRecord = null;
    try {
      savedRecord = await PulseDecisionModel.findOneAndUpdate(
        { organizationId, issueId: issueData.issue_id },
        {
          organizationId,
          issueId: issueData.issue_id,
          issueType: issueData.issue_type,
          entityId: issueData.entity_id,
          customerName: issueData.customer_name,
          companyName: issueData.company_name,
          contactEmail: issueData.contact_email,
          contactPhone: issueData.contact_phone,
          financialMetrics: issueData.financial_metrics,
          reason: decision.reason,
          recommendedAction: decision.recommended_action,
          messageDraft: decision.message_draft,
          confidence: decision.confidence,
          assumptions: decision.assumptions,
          requiresApproval: decision.requires_approval,
          status: 'PENDING_APPROVAL',
        },
        { upsert: true, new: true }
      );
    } catch (saveErr) {
      console.warn('[PulseController] Could not persist decision to DB:', saveErr);
    }

    return res.status(200).json({
      success: true,
      decision,
      savedRecord,
    });
  }

  /**
   * POST /api/v1/ai/pulse/execute
   * Human operator approves and executes the AI recommended action
   */
  static async executeDecision(req: Request, res: Response) {
    const user = (req as any).user;
    const organizationId = user?.organizationId || 'org_advmen_platform';
    const { issueId, actionType, notes } = req.body as {
      issueId: string;
      actionType?: 'DISPATCH_MESSAGE' | 'CREATE_TASK' | 'DISMISS';
      notes?: string;
    };

    if (!issueId) {
      throw AppError.badRequest('Missing issueId');
    }

    const decisionRecord = await PulseDecisionModel.findOne({ organizationId, issueId });
    if (!decisionRecord) {
      throw AppError.notFound('Pulse Decision Record');
    }

    if (actionType === 'DISMISS') {
      decisionRecord.status = 'DISMISSED';
      decisionRecord.executedAt = new Date();
      decisionRecord.executedBy = user?.name || 'Operator';
      await decisionRecord.save();

      return res.status(200).json({
        success: true,
        message: 'Pulse recommendation dismissed.',
        record: decisionRecord,
      });
    }

    // Auto-create a high-priority CRM Task for accountability
    try {
      const taskId = `TSK-${Date.now().toString().slice(-6)}`;
      await TaskModel.create({
        organizationId,
        taskId,
        title: `PULSE Action: ${decisionRecord.recommendedAction.slice(0, 70)}`,
        relatedTo: {
          type: decisionRecord.issueType === 'OVERDUE_INVOICE' ? 'ACCOUNT' : 'LEAD',
          id: decisionRecord.entityId,
          name: `${decisionRecord.customerName} (${decisionRecord.companyName})`,
        },
        ownerId: user?.id,
        assignedToName: user?.name || 'Assigned Rep',
        priority: 'URGENT',
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due in 24 hours
        status: 'PENDING',
        isCompleted: false,
        notes: `AI Drafted Message:\n"${decisionRecord.messageDraft}"\n\nAI Reason: ${decisionRecord.reason}`,
      });
    } catch (taskErr) {
      console.warn('[PulseController] Could not auto-create CRM Task:', taskErr);
    }

    decisionRecord.status = 'DISPATCHED';
    decisionRecord.executedAt = new Date();
    decisionRecord.executedBy = user?.name || 'Operator';
    decisionRecord.executionNotes = notes || 'Action approved and task queued.';
    await decisionRecord.save();

    return res.status(200).json({
      success: true,
      message: 'Decision approved! Outreach drafted and follow-up task registered in Tasks & Activities.',
      record: decisionRecord,
    });
  }
}
