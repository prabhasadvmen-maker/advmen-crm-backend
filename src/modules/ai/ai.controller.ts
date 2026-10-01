import { Request, Response } from 'express';
import { aiService } from './ai.service.js';
import { ApiResponse } from '../../shared/response/ApiResponse.js';

export class AiController {
  async generateLeadSummary(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const userId = req.user!.id;
    const { leadId } = req.body;

    const result = await aiService.generateLeadSummary(organizationId, userId, leadId);
    ApiResponse.success(res, result, 200, undefined, 'AI Lead Summary generated');
  }

  async generateEmailDraft(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const userId = req.user!.id;

    const result = await aiService.generateEmailDraft(organizationId, userId, req.body);
    ApiResponse.success(res, result, 200, undefined, 'AI Email Draft generated');
  }

  async runPipelineAudit(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const userId = req.user!.id;

    const result = await aiService.runPipelineAudit(organizationId, userId);
    ApiResponse.success(res, result, 200, undefined, 'Pipeline audit completed successfully');
  }
}

export const aiController = new AiController();
