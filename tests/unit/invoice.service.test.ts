import { InvoiceService } from '../../src/modules/invoices-payments/invoice.service.js';

describe('InvoiceService Unit Tests', () => {
  const service = new InvoiceService();

  describe('Service Contract & Method Signatures', () => {
    it('exposes essential invoicing & payment recording methods', () => {
      expect(typeof service.createInvoice).toBe('function');
      expect(typeof service.getInvoices).toBe('function');
      expect(typeof service.getInvoiceById).toBe('function');
      expect(typeof service.recordPayment).toBe('function');
      expect(typeof service.getRevenueMetrics).toBe('function');
    });
  });
});
