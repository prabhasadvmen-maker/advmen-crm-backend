import { z } from 'zod';

export const CreateLeadSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().min(6, 'Valid phone number is required'),
  email: z.string().email().optional().or(z.literal('')),
  company: z.string().optional().default('Individual Prospect'),
  title: z.string().optional(),
  source: z
    .enum([
      'WEBSITE',
      'LANDING_PAGE',
      'META_ADS',
      'GOOGLE_ADS',
      'LINKEDIN',
      'INBOUND_CALL',
      'REFERRAL',
      'MANUAL',
      'CSV_IMPORT',
      'API',
    ])
    .optional()
    .default('MANUAL'),
  campaignId: z.string().optional(),
  status: z
    .enum([
      'NEW',
      'ASSIGNED',
      'CONTACTED',
      'CONNECTED',
      'QUALIFIED',
      'MEETING',
      'PROPOSAL',
      'NEGOTIATION',
      'WON',
      'LOST',
    ])
    .optional()
    .default('NEW'),
  ownerId: z.string().optional(),
  budget: z.number().nonnegative().optional().default(0),
  requirement: z.string().optional(),
  nextFollowUpAt: z
    .union([z.string(), z.date()])
    .optional()
    .transform((val) => (val ? new Date(val).toISOString() : undefined)),
  tags: z.array(z.string()).optional().default([]),
  customFields: z.record(z.unknown()).optional().default({}),
});

export const UpdateLeadSchema = CreateLeadSchema.partial();

export const LeadFilterQuerySchema = z.object({
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 25)),
  status: z.string().optional(),
  ownerId: z.string().optional(),
  source: z.string().optional(),
  search: z.string().optional(),
  scoreCategory: z.enum(['HOT', 'WARM', 'COLD']).optional(),
  slaStatus: z.enum(['ON_TIME', 'APPROACHING_BREACH', 'BREACHED']).optional(),
});
