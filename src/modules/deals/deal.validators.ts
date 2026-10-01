import { z } from 'zod';

export const CreateDealSchema = z.object({
  title: z.string().min(1, 'Deal title is required'),
  company: z.string().min(1, 'Company name is required'),
  contactName: z.string().optional().default('Key Contact'),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  value: z.coerce.number().min(0, 'Value must be non-negative').default(0),
  currency: z.string().optional().default('USD'),
  stage: z
    .enum(['DISCOVERY', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'])
    .optional()
    .default('DISCOVERY'),
  pipelineId: z.string().optional().default('pipe_default'),
  probability: z.coerce.number().min(0).max(100).optional().default(10),
  expectedCloseDate: z
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
  ownerId: z.string().optional(),
  leadId: z.string().optional(),
  customFields: z.record(z.unknown()).optional().default({}),
});

export const UpdateDealSchema = CreateDealSchema.partial().extend({
  reason: z.string().optional(),
  competitorLostTo: z.string().optional(),
});

export const DealFilterQuerySchema = z.object({
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 50)),
  stage: z.string().optional(),
  pipelineId: z.string().optional(),
  ownerId: z.string().optional(),
  search: z.string().optional(),
});
