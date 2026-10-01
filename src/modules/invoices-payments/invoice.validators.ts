import { z } from 'zod';

export const CreateInvoiceSchema = z.object({
  proposalId: z.string().optional(),
  dealId: z.string().optional(),
  company: z.string().min(1, 'Company name is required'),
  recipientName: z.string().optional(),
  recipientEmail: z.string().email('Valid recipient email is required'),
  amount: z.union([z.number(), z.string().transform(Number)]).optional().default(25000),
  currency: z.string().optional().default('USD'),
  lineItems: z.array(z.any()).optional(),
  dueDate: z
    .union([z.string(), z.date()])
    .optional()
    .transform((val) => {
      if (!val) {
        const d = new Date();
        d.setDate(d.getDate() + 14);
        return d.toISOString();
      }
      return new Date(val).toISOString();
    }),
});

export const RecordPaymentSchema = z.object({
  paymentId: z.string().min(1, 'Payment transaction ID is required'),
  paymentProvider: z.string().optional().default('stripe'),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
});

export const InvoiceFilterQuerySchema = z.object({
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 25)),
  status: z.string().optional(),
  search: z.string().optional(),
});
