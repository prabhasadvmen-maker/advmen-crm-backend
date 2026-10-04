import { Request, Response } from 'express';
import { organizationService } from './organization.service.js';
import { ApiResponse } from '../../shared/response/ApiResponse.js';
import { AuthenticatedUser } from '../../middleware/auth.middleware.js';

export class OrganizationController {
  async getPublicOrganizations(req: Request, res: Response): Promise<void> {
    const orgs = await organizationService.getPublicOrganizations();
    ApiResponse.success(res, orgs, 200, undefined, 'Active workspace directory retrieved');
  }

  async getOrganizations(req: Request, res: Response): Promise<void> {
    const requester = req.user as AuthenticatedUser;
    const orgs = await organizationService.getOrganizations(requester);

    ApiResponse.success(res, orgs, 200, undefined, 'Tenant organizations retrieved successfully');
  }

  async getOrganizationById(req: Request, res: Response): Promise<void> {
    const requester = req.user as AuthenticatedUser;
    const org = await organizationService.getOrganizationById(requester, req.params.id);

    ApiResponse.success(res, org, 200, undefined, 'Organization details');
  }

  async updateOrganizationSettings(req: Request, res: Response): Promise<void> {
    const requester = req.user as AuthenticatedUser;
    const org = await organizationService.updateOrganizationSettings(
      requester,
      req.params.id,
      req.body
    );
    ApiResponse.success(res, org, 200, undefined, 'Organization settings saved');
  }

  async createOrganization(req: Request, res: Response): Promise<void> {
    const requester = req.user as AuthenticatedUser;
    const org = await organizationService.createOrganization(requester, req.body);

    ApiResponse.created(res, org, `Tenant organization '${org.name}' created successfully`);
  }

  async deleteOrganization(req: Request, res: Response): Promise<void> {
    const requester = req.user as AuthenticatedUser;
    const result = await organizationService.deleteOrganization(requester, req.params.id);
    ApiResponse.success(res, result, 200, undefined, `Tenant organization '${result.name}' deleted successfully`);
  }

  async getDashboardStats(req: Request, res: Response): Promise<void> {
    const requester = req.user as AuthenticatedUser;
    const stats = await organizationService.getDashboardStats(requester);
    ApiResponse.success(res, stats, 200, undefined, 'Dashboard stats retrieved successfully');
  }
}

export const organizationController = new OrganizationController();
