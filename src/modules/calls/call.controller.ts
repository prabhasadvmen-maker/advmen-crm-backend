import { Request, Response } from 'express';
import { callService } from './call.service.js';
import { telephonyService } from './telephony.service.js';
import { ApiResponse } from '../../shared/response/ApiResponse.js';
import { logger } from '../../shared/logger/logger.js';

export class CallController {
  async logCall(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const caller = { id: req.user!.id, name: req.user!.name };
    const call = await callService.logCall(organizationId, caller, req.body);
    ApiResponse.created(res, call, 'Call logged successfully');
  }

  async getCalls(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const result = await callService.getCalls(organizationId, req.query as never);
    ApiResponse.paginated(
      res,
      result.docs,
      result.total,
      result.page,
      result.limit,
      'Calls retrieved successfully'
    );
  }

  async getMetrics(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const metrics = await callService.getCallMetrics(
      organizationId,
      req.query.userId as string | undefined
    );
    ApiResponse.success(res, metrics, 200, undefined, 'Call metrics retrieved');
  }

  async getCallById(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const call = await callService.getCallById(organizationId, req.params.id);
    ApiResponse.success(res, call, 200, undefined, 'Call record retrieved');
  }

  async getVoiceToken(req: Request, res: Response): Promise<void> {
    const tokenData = telephonyService.generateVoiceToken(req.user!.id, req.organizationId!);
    ApiResponse.success(res, tokenData, 200, undefined, 'Voice capability token generated');
  }

  async handleVoiceWebhook(req: Request, res: Response): Promise<void> {
    logger.info('📞 Inbound Telephony Webhook Received:', req.body);
    // Return TwiML response for voice call handling
    res.type('text/xml');
    res.send('<Response><Say>Connecting to ADVMEN SalesOS representative.</Say><Dial/></Response>');
  }
}

export const callController = new CallController();
