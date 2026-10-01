import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/AppError.js';
import {
  PulseIssueData,
  PulseBusinessContext,
  PulseDecisionResponse,
  PulseDecisionSchema,
  OPENAI_PULSE_DECISION_JSON_SCHEMA,
} from './pulse.types.js';
import { PULSE_SYSTEM_PROMPT, buildPulseUserPrompt } from './pulse.prompts.js';

// Lazy-initialized OpenAI client
let openAIClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openAIClient) {
    const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // In development or demo mode, client will warn and route to fallback
      openAIClient = new OpenAI({ apiKey: 'dummy-key-for-fallback' });
    } else {
      openAIClient = new OpenAI({ apiKey });
    }
  }
  return openAIClient;
}

/**
 * ADVMEN PULSE - AI Decision & Messaging Layer
 * Core handler synthesizing context into strict structured decisions
 */
export async function generateAIDecision(
  issueData: PulseIssueData,
  businessContext: PulseBusinessContext
): Promise<PulseDecisionResponse> {
  // 1. Validation of incoming issue data
  if (!issueData || !issueData.issue_id || !issueData.financial_metrics) {
    throw AppError.badRequest('Invalid issueData payload: missing issue_id or financial_metrics');
  }

  const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const userPrompt = buildPulseUserPrompt(issueData, businessContext);

  // If no OpenAI key is configured, execute deterministic intelligence fallback
  if (!apiKey) {
    return generateDeterministicFallbackDecision(issueData, businessContext);
  }

  try {
    const client = getOpenAIClient();

    // 2. Official OpenAI Structured Outputs invocation
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2, // Low temperature for high consistency and adherence to guardrails
      response_format: {
        type: 'json_schema',
        json_schema: OPENAI_PULSE_DECISION_JSON_SCHEMA,
      },
      messages: [
        {
          role: 'system',
          content: PULSE_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error('OpenAI returned empty message content');
    }

    const parsedJson = JSON.parse(rawContent);

    // 3. Enforce strict Zod schema validation
    const validated = PulseDecisionSchema.parse({
      ...parsedJson,
      issue_id: issueData.issue_id, // Pin to input ID to prevent ID hallucination
      requires_approval: true,      // Absolute guardrail: must always require operator sign-off
    });

    return validated;
  } catch (error: any) {
    console.warn(`[ADVMEN PULSE] OpenAI invocation failed (${error.message}). Falling back to deterministic engine.`);
    return generateDeterministicFallbackDecision(issueData, businessContext);
  }
}

/**
 * Deterministic Fallback Engine
 * Adheres strictly to the same JSON Schema when offline or lacking API keys.
 * Preserves exact mathematical numbers and formats.
 */
export function generateDeterministicFallbackDecision(
  issueData: PulseIssueData,
  businessContext: PulseBusinessContext
): PulseDecisionResponse {
  const { amount, currency, formatted_amount, days_overdue } = issueData.financial_metrics;
  const orgName = businessContext.organization_name || 'ADVMEN Platform';
  const customerName = issueData.customer_name || 'Valued Client';
  const payLink = businessContext.payment_link_placeholder || 'https://billing.advmen.com/pay';

  switch (issueData.issue_type) {
    case 'OVERDUE_INVOICE': {
      const daysStr = days_overdue ? `${days_overdue} days` : 'recently';
      return {
        issue_id: issueData.issue_id,
        reason: `Invoice ${issueData.entity_id} for ${formatted_amount} is ${daysStr} overdue, impacting working capital and monthly cash collection velocity.`,
        recommended_action: 'Dispatch automated WhatsApp/SMS payment reminder with 1-click payment link and log priority callback task.',
        message_draft: `Hi ${customerName}, gentle reminder from ${orgName}. Invoice #${issueData.entity_id} for ${formatted_amount} was due on ${daysStr}. Please clear the outstanding balance via this instant link: ${payLink}. Reply here with payment confirmation or if you need an updated receipt. Thank you!`,
        confidence: (days_overdue && days_overdue > 30) ? 'HIGH' : 'MEDIUM',
        assumptions: [
          'Customer billing contact email and WhatsApp number are verified and active.',
          'No prior payment dispute has been raised on this invoice.',
          'Standard bank transfer reconciliation has been checked in the last 24 hours.'
        ],
        requires_approval: true,
      };
    }

    case 'STALLED_DEAL': {
      return {
        issue_id: issueData.issue_id,
        reason: `Deal ${issueData.entity_id} valued at ${formatted_amount} has had zero touchpoints over the past 14 days, creating pipeline stagnation risk.`,
        recommended_action: 'Schedule executive touchpoint or send low-friction value-added check-in message to decision-maker.',
        message_draft: `Hi ${customerName}, hope you're having a productive week. Following up on our recent proposal for ${issueData.company_name} (${formatted_amount}). Are you still planning to proceed this quarter, or should we pause for now? Happy to adjust scope if needed.`,
        confidence: 'HIGH',
        assumptions: [
          'Decision maker has not opted out of commercial discussions.',
          'Competitor evaluation is likely in progress.'
        ],
        requires_approval: true,
      };
    }

    case 'DORMANT_LEAD':
    default: {
      return {
        issue_id: issueData.issue_id,
        reason: `High-intent prospect ${customerName} at ${issueData.company_name} (Estimated Budget: ${formatted_amount}) has uncontacted inbound status.`,
        recommended_action: 'Initiate immediate multi-channel outreach (WhatsApp briefing + Phone call) within 2 business hours.',
        message_draft: `Hi ${customerName}, thanks for connecting with ${orgName}. Noticed your interest in our business solutions for ${issueData.company_name}. Would a quick 5-minute call today work to share our pricing sheet and implementation blueprint?`,
        confidence: 'HIGH',
        assumptions: [
          'Inbound inquiry details are accurate.',
          'Prospect is currently evaluating CRM and automation tools.'
        ],
        requires_approval: true,
      };
    }
  }
}
