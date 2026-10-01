import { proposalRepository } from './proposal.repository.js';
import { IProposal, ProposalModel, ProposalStatus } from './proposal.model.js';
import { AppError } from '../../shared/errors/AppError.js';

export class ProposalService {
  async createProposal(organizationId: string, data: Partial<IProposal> & { amount?: number }): Promise<IProposal> {
    const { proposalId, proposalNumber } = await proposalRepository.generateProposalNumber(organizationId);

    let items = data.items || [];
    const baseAmount = Number(data.amount) || 75000;
    if (items.length === 0) {
      items = [
        {
          description: `${data.dealTitle || data.company || 'Enterprise'} Platform Contract`,
          quantity: 1,
          unitPrice: baseAmount,
          total: baseAmount,
        },
      ];
    }

    const subtotal = items.reduce((acc, item) => acc + item.total, 0);
    const discount = data.discount || 0;
    const taxRate = data.taxRate || 0;
    const taxAmount = (subtotal - discount) * (taxRate / 100);
    const amount = data.amount ? Number(data.amount) : Math.max(0, subtotal - discount + taxAmount);

    const proposal = await proposalRepository.create(organizationId, {
      ...data,
      proposalId,
      proposalNumber,
      items,
      subtotal,
      discount,
      taxRate,
      amount,
      status: 'DRAFT',
    });

    return proposal;
  }

  async getProposals(organizationId: string, query: { page?: number; limit?: number; status?: string; dealId?: string }) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.dealId) filter.dealId = query.dealId;

    return proposalRepository.findPaginated(organizationId, filter, {
      page: query.page,
      limit: query.limit,
      sort: { createdAt: -1 },
    });
  }

  async getProposalById(organizationId: string, id: string): Promise<IProposal> {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const filter = isObjectId ? { _id: id } : { proposalId: id };
    const proposal = await proposalRepository.findOne(organizationId, filter);
    if (!proposal) {
      throw AppError.notFound('Proposal');
    }
    return proposal;
  }

  async updateProposalStatus(organizationId: string, id: string, status: ProposalStatus): Promise<IProposal> {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const filter = isObjectId ? { _id: id } : { proposalId: id };

    const updateData: Partial<IProposal> = { status };
    if (status === 'VIEWED') updateData.viewedAt = new Date();
    if (status === 'ACCEPTED') updateData.acceptedAt = new Date();
    if (status === 'DECLINED') updateData.declinedAt = new Date();

    const updated = await proposalRepository.updateOne(organizationId, filter, updateData);
    if (!updated) {
      throw AppError.notFound('Proposal');
    }

    if (status === 'SENT' && updated.recipientEmail) {
      import('../../shared/services/email.service.js').then(({ emailService }) => {
        emailService.sendProposalEmail(updated.recipientEmail, updated.proposalNumber, (updated as any).company || 'Client', updated.amount);
      }).catch(() => {});
    }

    return updated;
  }

  async deleteProposal(organizationId: string, id: string): Promise<void> {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const filter = isObjectId ? { _id: id, organizationId } : { proposalId: id, organizationId };
    const result = await ProposalModel.deleteOne(filter);
    if ((result.deletedCount ?? 0) === 0) {
      throw AppError.notFound('Proposal');
    }
  }
}

export const proposalService = new ProposalService();
