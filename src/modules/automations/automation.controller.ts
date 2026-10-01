import { Request, Response } from 'express';
import { automationService } from './automation.service.js';
import { ApiResponse } from '../../shared/response/ApiResponse.js';

export class AutomationController {
  async createAutomation(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const automation = await automationService.createAutomation(organizationId, req.body);
    ApiResponse.created(res, automation, 'Automation workflow created successfully');
  }

  async getAutomations(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const result = await automationService.getAutomations(organizationId, req.query as never);
    ApiResponse.paginated(
      res,
      result.docs,
      result.total,
      result.page,
      result.limit,
      'Automations retrieved'
    );
  }

  async toggleAutomation(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const updated = await automationService.toggleAutomation(
      organizationId,
      req.params.id,
      req.body.isActive
    );
    ApiResponse.success(res, updated, 200, undefined, 'Workflow status updated');
  }

  async deleteAutomation(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    await automationService.deleteAutomation(organizationId, req.params.id);
    ApiResponse.success(res, { deleted: true }, 200, undefined, 'Workflow deleted successfully');
  }
}

export const automationController = new AutomationController();
