/**
 * Comprehensive Error Handling & Debugging System
 * Provides structured error handling, logging, and user-friendly error messages
 */

export interface AppError {
  code: string;
  message: string;
  userMessage: string; // User-friendly error message
  status?: number;
  originalError?: Error | unknown;
  context?: Record<string, unknown>;
  timestamp: Date;
  isDevelopment: boolean;
}

export class ErrorHandler {
  private static isDev = import.meta.env.DEV;

  /**
   * Log structured errors with context
   */
  static logError(
    code: string,
    message: string,
    context?: Record<string, unknown>,
    originalError?: Error | unknown
  ): AppError {
    const error: AppError = {
      code,
      message,
      userMessage: this.getUserMessage(code),
      context,
      originalError,
      timestamp: new Date(),
      isDevelopment: this.isDev,
    };

    // Log to console in development
    if (this.isDev) {
      console.group(`❌ [${code}] ${message}`);
      console.error("Error Details:", error);
      if (originalError) {
        console.error("Original Error:", originalError);
      }
      if (context) {
        console.error("Context:", context);
      }
      console.groupEnd();
    }

    // In production, you might want to send to error tracking service
    // e.g., Sentry.captureException(error);

    return error;
  }

  /**
   * Handle Supabase-specific errors
   */
  static handleSupabaseError(error: unknown, operation: string): AppError {
    const err = error as any;

    // Handle Supabase auth errors
    if (err?.status === 401) {
      return this.logError(
        "AUTH_INVALID_CREDENTIALS",
        "Invalid email or password",
        { operation },
        error
      );
    }

    if (err?.status === 400 && err?.message?.includes("Invalid login credentials")) {
      return this.logError(
        "AUTH_INVALID_CREDENTIALS",
        "Invalid email or password",
        { operation },
        error
      );
    }

    if (err?.status === 400 && err?.message?.includes("Email not confirmed")) {
      return this.logError(
        "AUTH_EMAIL_NOT_CONFIRMED",
        "Email not confirmed. Please check your inbox.",
        { operation, email: err?.message },
        error
      );
    }

    if (err?.status === 400 && err?.message?.includes("User already registered")) {
      return this.logError(
        "AUTH_USER_EXISTS",
        "This email is already registered",
        { operation },
        error
      );
    }

    if (err?.code === "over_email_send_rate_limit" || err?.status === 429) {
      return this.logError(
        "AUTH_RATE_LIMIT",
        "Email rate limit exceeded. Please wait a few minutes before trying again.",
        { operation, code: err?.code },
        error
      );
    }

    // Handle RLS policy errors
    if (err?.code === "42501" || err?.message?.includes("permission")) {
      return this.logError(
        "RLS_POLICY_ERROR",
        "Access denied: Row-level security policy violation",
        { operation, sqlError: err?.code },
        error
      );
    }

    // Handle connection errors
    if (err?.message?.includes("Failed to fetch") || !navigator.onLine) {
      return this.logError(
        "NETWORK_ERROR",
        "Network connection error",
        { operation, isOnline: navigator.onLine },
        error
      );
    }

    // Handle timeout errors
    if (err?.code === "REQUEST_TIMEOUT") {
      return this.logError(
        "TIMEOUT_ERROR",
        "Request timeout - server is not responding",
        { operation },
        error
      );
    }

    // Generic Supabase error
    return this.logError(
      "SUPABASE_ERROR",
      err?.message || "Database operation failed",
      { operation, status: err?.status, code: err?.code },
      error
    );
  }

  /**
   * Handle validation errors
   */
  static handleValidationError(field: string, message: string): AppError {
    return this.logError(
      "VALIDATION_ERROR",
      `Validation failed for ${field}`,
      { field, message }
    );
  }

  /**
   * Get user-friendly error message based on error code
   */
  private static getUserMessage(code: string): string {
    const messages: Record<string, string> = {
      AUTH_INVALID_CREDENTIALS:
        "Invalid email or password. Please try again.",
      AUTH_EMAIL_NOT_CONFIRMED:
        "Your email hasn't been confirmed yet. Check your inbox for a confirmation link.",
      AUTH_USER_EXISTS:
        "This email is already registered. Try logging in instead.",
      AUTH_RATE_LIMIT:
        "Too many requests. Please wait a moment before trying again (Supabase email limit).",
      AUTH_NOT_AUTHENTICATED:
        "You need to be logged in to access this feature.",
      RLS_POLICY_ERROR:
        "Access denied. Contact support if you think this is a mistake.",
      NETWORK_ERROR:
        "Network connection error. Please check your internet and try again.",
      TIMEOUT_ERROR:
        "The request took too long. Please try again.",
      SUPABASE_ERROR:
        "Something went wrong. Please try again later.",
      PROFILE_NOT_FOUND:
        "User profile not found. Please register first.",
      DATABASE_ERROR:
        "Database error occurred. Please try again.",
      VALIDATION_ERROR:
        "Please check your input and try again.",
      UNKNOWN_ERROR:
        "An unexpected error occurred. Please try again.",
    };

    return messages[code] || messages.UNKNOWN_ERROR;
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): { valid: boolean; error: AppError | null } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      return {
        valid: false,
        error: this.handleValidationError("email", "Email is required"),
      };
    }

    if (!emailRegex.test(email)) {
      return {
        valid: false,
        error: this.handleValidationError("email", "Invalid email format"),
      };
    }

    return { valid: true, error: null };
  }

  /**
   * Validate password
   */
  static validatePassword(password: string, minLength = 6): { valid: boolean; error: AppError | null } {
    if (!password) {
      return {
        valid: false,
        error: this.handleValidationError("password", "Password is required"),
      };
    }

    if (password.length < minLength) {
      return {
        valid: false,
        error: this.handleValidationError(
          "password",
          `Password must be at least ${minLength} characters`
        ),
      };
    }

    return { valid: true, error: null };
  }

  /**
   * Log successful operations (for debugging)
   */
  static logSuccess(operation: string, context?: Record<string, unknown>) {
    if (this.isDev) {
      console.log(`✅ [${operation}]`, context || "");
    }
  }

  /**
   * Log debug information
   */
  static logDebug(label: string, data: unknown) {
    if (this.isDev) {
      console.log(`🔍 [${label}]`, data);
    }
  }

  /**
   * Check if error is of specific type
   */
  static isAuthError(error: AppError): boolean {
    return error.code.startsWith("AUTH_");
  }

  static isNetworkError(error: AppError): boolean {
    return (
      error.code === "NETWORK_ERROR" ||
      error.code === "TIMEOUT_ERROR"
    );
  }

  static isRLSError(error: AppError): boolean {
    return error.code === "RLS_POLICY_ERROR";
  }
}

/**
 * Custom error class for app-specific errors
 */
export class AppErrorException extends Error {
  constructor(public appError: AppError) {
    super(appError.userMessage);
    this.name = "AppError";
  }
}
