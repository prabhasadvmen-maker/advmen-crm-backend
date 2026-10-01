import { z } from 'zod';

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(100),
  planTier: z.enum(['STARTER', 'BUSINESS', 'ENTERPRISE']).default('ENTERPRISE'),
  limits: z
    .object({
      maxUsers: z.number().min(1).default(25),
      maxLeads: z.number().min(100).default(10000),
      maxStorageMb: z.number().min(500).default(10240),
      aiTokensIncluded: z.number().min(1000).default(250000),
    })
    .optional(),
  settings: z
    .object({
      timezone: z.string().default('UTC'),
      currency: z.string().default('USD'),
      leadResponseSlaMinutes: z.number().default(15),
      allowTelephonyRecording: z.boolean().default(true),
    })
    .optional(),
});

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;
