/**
 * ORACLE SERVICE — the AI advisor.
 *
 * The browser never talks to the model provider and never holds an API key. (Previously the Gemini
 * key was read from VITE_GEMINI_API_KEY, i.e. compiled into the public JS bundle where anyone could
 * copy it from DevTools and run up the bill.) Requests go to the `oracle` Supabase Edge Function,
 * which authenticates the player, enforces their plan's daily quota, builds the context from the
 * database (never trusting client-supplied stats) and holds the secret.
 */
import { supabase } from "../lib/supabase";

export type OracleReply = { reply: string; used?: number; limit?: number | null };

export class OracleError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "OracleError";
    this.code = code;
  }
}

async function readBody(err: unknown): Promise<{ error?: string; code?: string } | null> {
  const ctx = (err as { context?: Response } | null)?.context;
  if (!ctx || typeof ctx.json !== "function") return null;
  try { return await ctx.json(); } catch { return null; }
}

export const OracleService = {
  consult: async (query: string, mode: "short" | "long" = "short"): Promise<string> => {
    if (!supabase) throw new OracleError("OFFLINE", "The Oracle is offline: Supabase is not configured.");

    const { data, error } = await supabase.functions.invoke<OracleReply>("oracle", { body: { query, mode } });
    if (error) {
      const body = await readBody(error);
      if (body?.code === "QUOTA_EXCEEDED") throw new OracleError("QUOTA_EXCEEDED", body.error ?? "Daily Oracle limit reached.");
      throw new OracleError(body?.code ?? "ORACLE_ERROR", body?.error ?? "The Oracle could not be reached. Try again shortly.");
    }
    return data?.reply?.trim() || "System silence.";
  },
};
