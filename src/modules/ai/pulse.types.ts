import { z } from 'zod';

export type PulseIssueType = 'OVERDUE_INVOICE' | 'STALLED_DEAL' | 'DORMANT_LEAD' | 'CHURN_RISK';

export type PulseConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface PulseIssueData {
  issue_id: string;
  issue_type: PulseIssueType;
  entity_id: string;
  customer_name: string;
  company_name: string;
  contact_email?: string;
  contact_phone?: string;
  // Deterministic figures computed strictly by code/rules engine
  financial_metrics: {
    amount: number;
    currency: string;
    formatted_amount: string;
    days_overdue?: number;
    probability_pct?: number;
  };
  detected_at: string;
  metadata?: Record<string, any>;
}

export interface PulseBusinessContext {
  organization_name: string;
  business_type?: string;
  brand_tone?: 'PROFESSIONAL' | 'FIRM' | 'FRIENDLY' | 'CONCILIATORY';
  escalation_tier?: 1 | 2 | 3;
  payment_link_placeholder?: string;
}

// Zod Schema matching the OpenAI Structured Output
export const PulseDecisionSchema = z.object({
  issue_id: z.string().describe('The matching issue identifier'),
  reason: z.string().describe('Short, punchy explanation of why this issue matters to revenue or relationships'),
  recommended_action: z.string().describe('Precise, unambiguous next step for the team'),
  message_draft: z.string().describe('Personalized outreach message ready for WhatsApp or Email'),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).describe('AI confidence level in the proposed strategy'),
  assumptions: z.array(z.string()).describe('Explicit assumptions made during decision synthesis'),
  requires_approval: z.literal(true).describe('Safety guardrail: always true for human-in-the-loop review'),
});

export type PulseDecisionResponse = z.infer<typeof PulseDecisionSchema>;

// OpenAI JSON Schema representation for response_format: { type: "json_schema", ... }
export const OPENAI_PULSE_DECISION_JSON_SCHEMA = {
  name: 'advmen_pulse_decision',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      issue_id: {
        type: 'string',
        description: 'The exact issue identifier provided in input data.',
      },
      reason: {
        type: 'string',
        description: 'Short, punchy explanation (1-2 sentences) of why this issue matters to cash flow, deal velocity, or customer retention.',
      },
      recommended_action: {
        type: 'string',
        description: 'Clear, high-impact next step for the sales or finance rep (e.g., Send WhatsApp reminder, Schedule executive check-in, Dispatch revised payment schedule).',
      },
      message_draft: {
        type: 'string',
        description: 'Personalized, contextual message draft tailored for WhatsApp/Email. Must use the exact provided financial numbers and invoice/deal references without hallucinating any values.',
      },
      confidence: {
        type: 'string',
        enum: ['HIGH', 'MEDIUM', 'LOW'],
        description: 'Confidence in this recommendation based on available context.',
      },
      assumptions: {
        type: {
          type: 'array',
          items: { type: 'string' },
        },
        items: {
          type: 'string',
        },
        description: 'List of realistic assumptions made (e.g. contact details are verified, customer preferred channel is WhatsApp).',
      },
      requires_approval: {
        type: 'boolean',
        description: 'Guardrail flag. MUST ALWAYS be true to require human-in-the-loop operator approval before executing any action.',
      },
    },
    required: [
      'issue_id',
      'reason',
      'recommended_action',
      'message_draft',
      'confidence',
      'assumptions',
      'requires_approval',
    ],
    additionalProperties: false,
  },
} as const;
