import { Request, Response } from 'express';
import { departmentService } from './department.service.js';
import { ApiResponse } from '../../shared/response/ApiResponse.js';
import { AppError } from '../../shared/errors/AppError.js';

export class DepartmentController {
  async getDepartments(req: Request, res: Response): Promise<void> {
    const orgId =
      req.user?.organizationId ||
      (req.headers['x-target-organization-id'] as string) ||
      'org_advmen_platform';
    const departments = await departmentService.getDepartments(orgId);
    ApiResponse.success(res, { departments }, 200, undefined, 'Active departments retrieved');
  }

  async addDepartment(req: Request, res: Response): Promise<void> {
    const orgId =
      req.user?.organizationId ||
      (req.headers['x-target-organization-id'] as string) ||
      'org_advmen_platform';
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      throw AppError.badRequest('Department name is required');
    }
    const result = await departmentService.addDepartment(orgId, name);
    ApiResponse.success(res, result, 201, undefined, `Department '${result.department}' created successfully`);
  }
}

export const departmentController = new DepartmentController();
