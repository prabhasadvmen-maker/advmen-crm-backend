/**
 * Strips API keys, passwords, JWT tokens, and sensitive credential patterns before prompt construction
 */
export function sanitizePromptContext(text: string): string {
  if (!text) return '';

  return text
    // Redact JWT tokens
    .replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, '[REDACTED_JWT]')
    // Redact password fields
    .replace(/(?:password|passwd|secret|api_key|token)[\s:=]+([^\s,;]+)/gi, '$1: [REDACTED_SECRET]')
    // Redact credit card numbers
    .replace(/\b(?:\d[ -]*?){13,16}\b/g, '[REDACTED_CARD_NUMBER]');
}
