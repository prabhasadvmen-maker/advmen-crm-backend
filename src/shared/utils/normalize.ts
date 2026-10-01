/**
 * Normalize phone numbers to E.164-compatible clean format (+91xxxxxxxxxx / standard digits)
 */
export function normalizePhone(rawPhone: string): string {
  if (!rawPhone) return '';
  // Remove spaces, hyphens, brackets, dots
  let cleaned = rawPhone.replace(/[\s\-().]/g, '');
  // If starts with 00, replace with +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }
  return cleaned;
}

/**
 * Normalize email addresses (trim + lowercase)
 */
export function normalizeEmail(rawEmail: string): string {
  if (!rawEmail) return '';
  return rawEmail.trim().toLowerCase();
}
