import { Request, Response } from 'express';
import { invoiceService } from './invoice.service.js';
import { ApiResponse } from '../../shared/response/ApiResponse.js';

export class InvoiceController {
  async createInvoice(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const invoice = await invoiceService.createInvoice(organizationId, req.body);
    ApiResponse.created(res, invoice, 'Invoice created successfully');
  }

  async getInvoices(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const result = await invoiceService.getInvoices(organizationId, req.query as never);
    ApiResponse.paginated(
      res,
      result.docs,
      result.total,
      result.page,
      result.limit,
      'Invoices retrieved successfully'
    );
  }

  async getInvoiceById(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const invoice = await invoiceService.getInvoiceById(organizationId, req.params.id);
    ApiResponse.success(res, invoice, 200, undefined, 'Invoice details retrieved');
  }

  async recordPayment(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const invoice = await invoiceService.recordPayment(organizationId, req.params.id, req.body);
    ApiResponse.success(res, invoice, 200, undefined, 'Payment recorded successfully');
  }

  async getRevenueMetrics(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    const metrics = await invoiceService.getRevenueMetrics(organizationId);
    ApiResponse.success(res, metrics, 200, undefined, 'Revenue metrics retrieved');
  }

  async deleteInvoice(req: Request, res: Response): Promise<void> {
    const organizationId = req.organizationId!;
    await invoiceService.deleteInvoice(organizationId, req.params.id);
    ApiResponse.success(res, { deleted: true }, 200, undefined, 'Invoice deleted successfully');
  }
}

export const invoiceController = new InvoiceController();
