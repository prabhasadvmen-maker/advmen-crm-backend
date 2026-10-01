import { z } from 'zod';

export const CreateProposalSchema = z.object({
  dealId: z.string().optional(),
  dealTitle: z.string().optional(),
  company: z.string().min(1, 'Company name is required'),
  recipientName: z.string().optional().default('Decision Maker'),
  recipientEmail: z.string().email('Valid recipient email is required'),
  amount: z.union([z.number(), z.string().transform(Number)]).optional(),
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative(),
        total: z.number().nonnegative(),
      })
    )
    .optional(),
  taxRate: z.number().min(0).optional().default(0),
  discount: z.number().min(0).optional().default(0),
  currency: z.string().optional().default('USD'),
  validUntil: z
    .union([z.string(), z.date()])
    .optional()
    .transform((val) => {
      if (!val) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString();
      }
      return new Date(val).toISOString();
    }),
});

export const UpdateProposalStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED']),
});
