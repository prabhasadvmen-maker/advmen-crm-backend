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

  async getDepartmentRoles(req: Request, res: Response): Promise<void> {
    const orgId =
      req.user?.organizationId ||
      (req.headers['x-target-organization-id'] as string) ||
      'org_advmen_platform';
    const roles = await departmentService.getDepartmentRoles(orgId);
    ApiResponse.success(res, { roles }, 200, undefined, 'Department roles retrieved');
  }

  async addDepartmentRole(req: Request, res: Response): Promise<void> {
    const orgId =
      req.user?.organizationId ||
      (req.headers['x-target-organization-id'] as string) ||
      'org_advmen_platform';
    const { department, role, label, description } = req.body;
    if (!department || !label) {
      throw AppError.badRequest('Department and role label are required');
    }
    const result = await departmentService.addDepartmentRole(orgId, department, {
      role,
      label,
      description,
    });
    ApiResponse.success(res, result, 201, undefined, `Role '${label}' added to '${department}'`);
  }
}

export const departmentController = new DepartmentController();
