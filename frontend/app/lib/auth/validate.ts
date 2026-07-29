/** Lightweight client-side auth validation shared by the auth forms. */

export const MIN_PASSWORD_LENGTH = 8;

// Pragmatic email shape check; the server remains the source of truth.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | undefined {
  const trimmed = email.trim();
  if (trimmed.length === 0) return "Enter your email address.";
  if (!EMAIL_PATTERN.test(trimmed)) return "Enter a valid email address.";
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (password.length === 0) return "Enter a password.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return undefined;
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | undefined {
  if (confirmation.length === 0) return "Re-enter your password.";
  if (password !== confirmation) return "Passwords do not match.";
  return undefined;
}
