import { Request, Response } from 'express';
import { ApiResponse } from '../../shared/response/ApiResponse.js';
import { whatsAppAutomationService } from './whatsappAutomation.service.js';

export class WhatsAppAutomationController {
  async searchConsentLeads(req: Request, res: Response): Promise<void> {
    const leads = await whatsAppAutomationService.searchConsentLeads(
      req.organizationId!,
      String(req.query.search || '')
    );
    ApiResponse.success(res, { leads });
  }

  async updateWhatsAppConsent(req: Request, res: Response): Promise<void> {
    await whatsAppAutomationService.updateWhatsAppConsent(
      req.organizationId!,
      req.params.leadId,
      req.user!.id,
      req.body.status,
      req.body.evidence
    );
    ApiResponse.success(res, { status: req.body.status }, 200, undefined, 'WhatsApp consent updated');
  }

  async listDrafts(req: Request, res: Response): Promise<void> {
    const result = await whatsAppAutomationService.listDrafts(
      req.organizationId!,
      typeof req.query.cursor === 'string' ? req.query.cursor : undefined
    );
    ApiResponse.success(res, result);
  }

  async generateDraftBatch(req: Request, res: Response): Promise<void> {
    const result = await whatsAppAutomationService.generateNextDraftBatch(
      req.organizationId!,
      req.user!.id,
      req.body.cursor
    );
    ApiResponse.success(res, result, 200, undefined, 'WhatsApp draft batch generated');
  }

  async approveAndSend(req: Request, res: Response): Promise<void> {
    const result = await whatsAppAutomationService.approveAndSend(
      req.organizationId!,
      req.params.draftId,
      req.user!.id
    );
    ApiResponse.success(res, result, 200, undefined, 'WhatsApp message sent');
  }

  async rejectDraft(req: Request, res: Response): Promise<void> {
    await whatsAppAutomationService.rejectDraft(
      req.organizationId!,
      req.params.draftId,
      req.user!.id
    );
    ApiResponse.success(res, { status: 'REJECTED' }, 200, undefined, 'WhatsApp draft rejected');
  }
}

export const whatsAppAutomationController = new WhatsAppAutomationController();
