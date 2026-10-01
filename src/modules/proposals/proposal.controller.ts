import { Request, Response } from 'express';
import { proposalService } from './proposal.service.js';
import { ApiResponse } from '../../shared/response/ApiResponse.js';

export class ProposalController {
  async createProposal(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const proposal = await proposalService.createProposal(organizationId, req.body);
    ApiResponse.created(res, proposal, 'Proposal generated successfully');
  }

  async getProposals(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const result = await proposalService.getProposals(organizationId, req.query as never);
    ApiResponse.paginated(
      res,
      result.docs,
      result.total,
      result.page,
      result.limit,
      'Proposals retrieved successfully'
    );
  }

  async getProposalById(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const proposal = await proposalService.getProposalById(organizationId, req.params.id);
    ApiResponse.success(res, proposal, 200, undefined, 'Proposal details retrieved');
  }

  async updateProposalStatus(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const updated = await proposalService.updateProposalStatus(
      organizationId,
      req.params.id,
      req.body.status
    );
    ApiResponse.success(res, updated, 200, undefined, 'Proposal status updated');
  }

  async deleteProposal(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    await proposalService.deleteProposal(organizationId, req.params.id);
    ApiResponse.success(res, { deleted: true }, 200, undefined, 'Proposal deleted successfully');
  }
}

export const proposalController = new ProposalController();
