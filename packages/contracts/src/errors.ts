/**
 * Stable error codes returned by the shared backend. Clients branch on `code`, never on message text.
 */
export const ERROR_CODES = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  UNKNOWN_FORM: "UNKNOWN_FORM",
  FORM_INACTIVE: "FORM_INACTIVE",
  CONSENT_REQUIRED: "CONSENT_REQUIRED",
  NOTICE_VERSION_MISMATCH: "NOTICE_VERSION_MISMATCH",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  SPAM_SUSPECTED: "SPAM_SUSPECTED",
  STORAGE_UNAVAILABLE: "STORAGE_UNAVAILABLE",
  UNAUTHORISED: "UNAUTHORISED",
  NOT_FOUND: "NOT_FOUND",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
    /** Field-level problems for VALIDATION_FAILED. Never echoes submitted values. */
    fields?: Record<string, string>;
  };
}
