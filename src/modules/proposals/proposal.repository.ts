import { BaseTenantRepository } from '../../shared/repository/BaseTenantRepository.js';
import { IProposal, ProposalModel } from './proposal.model.js';

export class ProposalRepository extends BaseTenantRepository<IProposal> {
  constructor() {
    super(ProposalModel);
  }

  async generateProposalNumber(organizationId: string): Promise<{ proposalId: string; proposalNumber: string }> {
    const count = await this.model.countDocuments({ organizationId });
    const year = new Date().getFullYear();
    const proposalNumber = `PROP-${year}-${1001 + count}`;
    return { proposalId: proposalNumber, proposalNumber };
  }
}

export const proposalRepository = new ProposalRepository();
