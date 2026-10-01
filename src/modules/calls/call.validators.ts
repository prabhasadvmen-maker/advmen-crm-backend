import { z } from 'zod';

export const LogCallSchema = z.object({
  leadId: z.string().min(1, 'Lead ID is required'),
  leadName: z.string().optional(),
  leadPhone: z.string().min(6, 'Lead phone is required'),
  leadCompany: z.string().optional(),
  status: z
    .enum(['QUEUED', 'RINGING', 'CONNECTED', 'COMPLETED', 'MISSED', 'BUSY', 'FAILED'])
    .optional()
    .default('COMPLETED'),
  disposition: z
    .enum([
      'INTERESTED',
      'CALLBACK_REQUESTED',
      'NOT_INTERESTED',
      'WRONG_NUMBER',
      'MEETING_BOOKED',
      'VOICEMAIL',
    ])
    .optional(),
  durationSeconds: z.number().nonnegative().optional().default(0),
  startedAt: z
    .union([z.string(), z.date()])
    .optional()
    .transform((val) => (val ? new Date(val).toISOString() : undefined)),
  endedAt: z
    .union([z.string(), z.date()])
    .optional()
    .transform((val) => (val ? new Date(val).toISOString() : undefined)),
  notes: z.string().optional(),
  transcriptSnippet: z.string().optional(),
  aiSentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']).optional(),
});

export const CallFilterQuerySchema = z.object({
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 25)),
  userId: z.string().optional(),
  leadId: z.string().optional(),
  disposition: z.string().optional(),
  status: z.string().optional(),
});
