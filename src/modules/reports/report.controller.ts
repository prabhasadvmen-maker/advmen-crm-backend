import { Request, Response } from 'express';
import { ApiResponse } from '../../shared/response/ApiResponse.js';
import { reportService } from './report.service.js';

export class ReportController {
  async getOverview(req: Request, res: Response): Promise<void> {
    const report = await reportService.getOverview(req.organizationId!);
    ApiResponse.success(res, report, 200, undefined, 'Reports retrieved successfully');
  }
}

export const reportController = new ReportController();
