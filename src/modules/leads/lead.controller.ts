import { Request, Response } from 'express';
import { leadService } from './lead.service.js';
import { ApiResponse } from '../../shared/response/ApiResponse.js';
import { leadImportService } from './lead-import.service.js';
import { AppError } from '../../shared/errors/AppError.js';

export class LeadController {
  async createLead(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const lead = await leadService.createLead(organizationId, req.body);
    ApiResponse.created(res, lead, 'Lead captured successfully');
  }

  async getLeads(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const result = await leadService.getLeads(organizationId, req.query as never, req.user!);
    ApiResponse.paginated(
      res,
      result.docs,
      result.total,
      result.page,
      result.limit,
      'Leads retrieved successfully'
    );
  }

  async getLeadById(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const lead = await leadService.getLeadById(organizationId, req.params.id);
    ApiResponse.success(res, lead, 200, undefined, 'Lead details retrieved');
  }

  async updateLead(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const updated = await leadService.updateLead(organizationId, req.params.id, req.body);
    ApiResponse.success(res, updated, 200, undefined, 'Lead updated successfully');
  }

  async deleteLead(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    await leadService.deleteLead(organizationId, req.params.id);
    ApiResponse.success(res, { deleted: true }, 200, undefined, 'Lead deleted successfully');
  }

  async getMetrics(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const metrics = await leadService.getMetrics(organizationId);
    ApiResponse.success(res, metrics, 200, undefined, 'Lead status metrics retrieved');
  }

  async previewImport(req: Request, res: Response): Promise<void> {
    if (!req.file) throw new Error('Please choose an Excel or CSV file.');
    ApiResponse.success(res, leadImportService.parse(req.file), 200, undefined, 'File scanned. Review valid and rejected rows before importing.');
  }

  async commitImport(req: Request, res: Response): Promise<void> {
    const result = await leadImportService.importRows(req.organizationId!, req.body.rows);
    ApiResponse.created(res, result, `${result.importedCount} leads imported.`);
  }

  async assignImported(req: Request, res: Response): Promise<void> {
    const result = await leadImportService.assign(req.organizationId!, req.body.leadIds, req.body.employeeId);
    ApiResponse.success(res, result, 200, undefined, `${result.assignedCount} leads assigned.`);
  }

  async assignQuantity(req: Request, res: Response): Promise<void> {
    const result = await leadImportService.assignQuantity(
      req.organizationId!,
      req.body.employeeId,
      Number(req.body.quantity)
    );
    ApiResponse.success(res, result, 200, undefined, `${result.assignedCount} leads assigned.`);
  }

  async distributeImported(req: Request, res: Response): Promise<void> {
    const result = await leadImportService.distributeEvenly(req.organizationId!, req.body.leadIds, req.body.employeeIds);
    ApiResponse.success(res, result, 200, undefined, `${result.assignedCount} leads distributed.`);
  }

  async distributeCustom(req: Request, res: Response): Promise<void> {
    const result = await leadImportService.distributeCustom(req.organizationId!, req.body.distribution);
    ApiResponse.success(res, result, 200, undefined, `${result.assignedCount} leads custom distributed.`);
  }

  async getBulkDeleteCount(req: Request, res: Response): Promise<void> {
    const result = await leadService.getBulkDeleteCount(req.organizationId!, req.body);
    ApiResponse.success(res, result, 200, undefined, `${result.count} leads match criteria.`);
  }

  async bulkDeleteLeads(req: Request, res: Response): Promise<void> {
    const result = await leadService.bulkDeleteLeads(req.organizationId!, req.body);
    ApiResponse.success(res, result, 200, undefined, `${result.deletedCount} leads deleted.`);
  }

  async getUnassignedSummary(req: Request, res: Response): Promise<void> {
    const summary = await leadImportService.getUnassignedSummary(req.organizationId!);
    ApiResponse.success(res, summary, 200, undefined, 'Unassigned leads summary retrieved');
  }

  async raiseQuery(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const lead = await leadService.raiseQuery(
      organizationId,
      req.params.id,
      { id: req.user!.id, name: req.user!.name, email: req.user!.email },
      req.body
    );
    ApiResponse.success(res, lead, 201, undefined, 'Query sent to Admin Telecaller Queue');
  }

  async resolveQuery(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const lead = await leadService.resolveQuery(
      organizationId,
      req.params.id,
      req.params.queryId,
      req.body.reply,
      { id: req.user!.id, name: req.user!.name }
    );
    ApiResponse.success(res, lead, 200, undefined, 'Query resolved successfully');
  }

  async getAllQueries(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const queries = await leadService.getAllLeadQueries(organizationId);
    ApiResponse.success(res, queries, 200, undefined, 'Lead queries retrieved');
  }

  async completeLead(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const lead = await leadService.completeLead(
      organizationId,
      req.params.id,
      { id: req.user!.id, name: req.user!.name },
      req.body
    );
    ApiResponse.success(res, lead, 200, undefined, 'Lead finalized successfully');
  }

  async getFinalizedLeads(req: Request, res: Response): Promise<void> {
    const teamRoles = ['SUPER_ADMIN', 'ORG_ADMIN', 'SALES_MANAGER'];
    if (!teamRoles.includes(req.user!.role)) {
      throw AppError.forbidden('Only administrators and sales managers can view all finalized leads');
    }
    const organizationId = req.organizationId!;
    const finalized = await leadService.getFinalizedLeads(organizationId);
    ApiResponse.success(res, finalized, 200, undefined, 'Finalized leads retrieved');
  }

  async getMyFinalizedLeads(req: Request, res: Response): Promise<void> {
    const finalized = await leadService.getFinalizedLeads(req.organizationId!, req.user!.id);
    ApiResponse.success(res, finalized, 200, undefined, 'Your finalized leads retrieved');
  }

  async getEmployeeStats(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const stats = await leadService.getEmployeeLeadStats(organizationId);
    ApiResponse.success(res, stats, 200, undefined, 'Employee lead statistics retrieved');
  }
}

export const leadController = new LeadController();
