import { createClient } from "@supabase/supabase-js";
import { logger } from "./logger";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Validate Supabase configuration
 */
export function validateSupabaseConfig(): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!supabaseUrl) {
    errors.push("VITE_SUPABASE_URL environment variable is not set");
  } else if (!supabaseUrl.startsWith("https://")) {
    errors.push("VITE_SUPABASE_URL must start with https://");
  }

  if (!supabaseAnonKey) {
    errors.push("VITE_SUPABASE_ANON_KEY environment variable is not set");
  } else if (supabaseAnonKey.length < 20) {
    errors.push("VITE_SUPABASE_ANON_KEY appears to be invalid (too short)");
  }

  if (errors.length > 0) {
    logger.error("Supabase configuration validation failed", {
      errors,
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
    });
  } else {
    logger.info("Supabase configuration validated successfully");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Initialize Supabase client with error handling
 */
export const supabase = hasSupabaseConfig
  ? (() => {
      try {
        logger.debug("Initializing Supabase client", {
          url: supabaseUrl?.substring(0, 30) + "...",
          keyLength: supabaseAnonKey?.length,
        });

        const client = createClient(supabaseUrl, supabaseAnonKey);
        logger.info("✅ Supabase client initialized successfully");
        return client;
      } catch (error) {
        logger.error("Failed to initialize Supabase client", {}, error as Error);
        return null;
      }
    })()
  : null;

/**
 * Get Supabase health status
 */
export async function checkSupabaseHealth(): Promise<{
  isHealthy: boolean;
  url: string | null;
  hasClient: boolean;
  configValid: boolean;
  error?: string;
}> {
  const configValid = validateSupabaseConfig().isValid;

  return {
    isHealthy: hasSupabaseConfig && !!supabase,
    url: supabaseUrl || null,
    hasClient: !!supabase,
    configValid,
  };
}

/**
 * Log Supabase configuration info (development only)
 */
export function logSupabaseInfo() {
  if (!import.meta.env.DEV) return;

  logger.info("📊 Supabase Configuration Info", {
    urlSet: !!supabaseUrl,
    keySet: !!supabaseAnonKey,
    clientInitialized: !!supabase,
    configValid: validateSupabaseConfig().isValid,
  });
}
