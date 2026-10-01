import { Request, Response } from 'express';
import { dealService } from './deal.service.js';
import { ApiResponse } from '../../shared/response/ApiResponse.js';

export class DealController {
  async createDeal(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const actorId = req.user!.id;
    const deal = await dealService.createDeal(organizationId, actorId, req.body);
    ApiResponse.created(res, deal, 'Deal created successfully');
  }

  async getDeals(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const result = await dealService.getDeals(organizationId, req.query as never);
    ApiResponse.paginated(
      res,
      result.docs,
      result.total,
      result.page,
      result.limit,
      'Deals retrieved successfully'
    );
  }

  async getDealById(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const deal = await dealService.getDealById(organizationId, req.params.id);
    ApiResponse.success(res, deal, 200, undefined, 'Deal details retrieved');
  }

  async updateDeal(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const actorId = req.user!.id;
    const updated = await dealService.updateDeal(organizationId, req.params.id, actorId, req.body);
    ApiResponse.success(res, updated, 200, undefined, 'Deal updated successfully');
  }

  async deleteDeal(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    await dealService.deleteDeal(organizationId, req.params.id);
    ApiResponse.success(res, { deleted: true }, 200, undefined, 'Deal deleted successfully');
  }

  async getPipelineMetrics(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const metrics = await dealService.getPipelineMetrics(
      organizationId,
      (req.query.pipelineId as string) || 'pipe_default'
    );
    ApiResponse.success(res, metrics, 200, undefined, 'Pipeline metrics retrieved');
  }
}

export const dealController = new DealController();
