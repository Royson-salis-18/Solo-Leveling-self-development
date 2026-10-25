import { supabase } from "./supabase";

/**
 * Typed error for anything the server (or the network) refuses.
 *
 * Postgres functions raise `CODE: human readable message`; we split that so the UI can branch
 * on `code` and show `message` verbatim. PostgREST / Postgres errors are normalised too.
 */
export class GameError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "GameError";
    this.code = code;
  }
}

const SERVER_FORMAT = /^([A-Z][A-Z0-9_]{2,}):\s*([\s\S]*)$/;

export function toGameError(err: unknown): GameError {
  if (err instanceof GameError) return err;
  const e = err as { message?: string; code?: string; status?: number } | null | undefined;
  const raw = e?.message ?? (typeof err === "string" ? err : "Something went wrong.");

  const m = SERVER_FORMAT.exec(raw);
  if (m) return new GameError(m[1], m[2].trim() || m[1]);

  if (e?.code === "42501" || /permission denied/i.test(raw)) {
    return new GameError("PERMISSION_DENIED", "You are not allowed to do that.");
  }
  if (e?.code === "23514") return new GameError("INVALID_INPUT", "That value is outside the allowed range.");
  if (e?.code === "23505") return new GameError("DUPLICATE", "That already exists.");
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return new GameError("NETWORK", "Can't reach the server. Check your connection and try again.");
  }
  if (/jwt|not authenticated|invalid token/i.test(raw)) {
    return new GameError("NOT_AUTHENTICATED", "Your session expired. Please sign in again.");
  }
  return new GameError(e?.code ?? "UNKNOWN", raw);
}

/** Call a Postgres function and throw a GameError on failure. */
export async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new GameError("OFFLINE", "The System is offline: Supabase is not configured.");
  const { data, error } = await supabase.rpc(fn, args as never);
  if (error) throw toGameError(error);
  return data as T;
}

/** Human message for any thrown value — what the UI should show in a toast. */
export function errorMessage(err: unknown): string {
  return toGameError(err).message;
}
