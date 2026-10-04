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
      currency: z.string().default('INR'),
      leadResponseSlaMinutes: z.number().default(15),
      allowTelephonyRecording: z.boolean().default(true),
    })
    .optional(),
});

export const UpdateOrganizationSettingsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  settings: z.object({
    timezone: z.string().trim().min(1).max(80),
    currency: z.enum(['INR', 'USD', 'EUR', 'GBP']),
    leadResponseSlaMinutes: z.number().int().min(1).max(10080),
    allowTelephonyRecording: z.boolean(),
  }),
});

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;
export type UpdateOrganizationSettingsInput = z.infer<typeof UpdateOrganizationSettingsSchema>;
