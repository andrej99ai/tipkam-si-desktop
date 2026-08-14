import { supabase } from "./supabase";

export type DictationMode = "accurate" | "live";

export interface DictationResult {
  raw_transcript: string;
  final_text: string;
}

/** Error types for smarter UI messages */
export type DictationErrorType = "timeout" | "quota" | "auth" | "generic";

export class DictationError extends Error {
  type: DictationErrorType;
  constructor(message: string, type: DictationErrorType = "generic") {
    super(message);
    this.type = type;
  }
}

/** Wrap a promise with a timeout (ms) */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new DictationError("timeout", "timeout")), ms);
    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

/** Detect error type from Supabase Edge Function response */
function classifyError(error: any, data: any): DictationError {
  // Defensive: error/data fields may occasionally be objects rather than
  // strings (e.g. nested error shapes). Coerce to string before lowercasing
  // so we never throw inside the catch path.
  const msg = String(error?.message ?? "").toLowerCase();
  const dataMsg = String(data?.error ?? data?.message ?? "").toLowerCase();
  const combined = msg + " " + dataMsg;

  // Quota / limit exceeded
  if (combined.includes("limit") || combined.includes("quota") ||
      combined.includes("exceeded") || combined.includes("minute") ||
      combined.includes("upgrade") || combined.includes("presegel") ||
      combined.includes("nadgrad")) {
    return new DictationError(combined, "quota");
  }

  // Auth / session expired
  if (combined.includes("auth") || combined.includes("jwt") ||
      combined.includes("token") || combined.includes("expired") ||
      combined.includes("unauthorized") || combined.includes("401") ||
      combined.includes("invalid claim")) {
    return new DictationError(combined, "auth");
  }

  return new DictationError(error?.message || "Unknown error", "generic");
}

// Timeout po načinu: Gemini Pro (accurate) na daljših posnetkih pogosto
// potrebuje več kot 60 s — spletna aplikacija sploh nima timeouta, zato tam
// napake ni. 60 s je bil glavni vzrok "ni transkripta" napak na desktopu.
const TIMEOUT_FAST_MS = 90_000;      // 1,5 min za Flash
const TIMEOUT_ACCURATE_MS = 240_000; // 4 min za Pro (dolgi posnetki + thinking)

/**
 * Pošlje avdio na Supabase Edge Function za transkripcijo.
 *
 * Tok:
 * 1. Kliče "voice-to-text" Edge Function z audio, mime_type, language_code
 * 2. Za SL backend že sam lektorira (združen Gemini Pro prompt)
 *
 * Logika izbire modela (v Edge Function):
 * - language_code = "sl" (brez "mode") → Gemini 2.5 Pro
 * - Vsi ostali jeziki                  → Gemini 2.5 Flash
 */
export async function processDictation(
  audioBase64: string,
  mode: DictationMode,
  languageCode: string = "sl",
  durationSeconds?: number
): Promise<DictationResult> {
  const isSlovenian = languageCode === "sl";

  // ── Korak 1: Transkripcija (voice-to-text) ──
  const body: Record<string, unknown> = {
    audio: audioBase64,
    mime_type: "audio/webm",
    language_code: languageCode,
  };

  // "mode" se ne pošilja več: za slovenščino je hitri način odstranjen,
  // zato backend brez "mode" vedno uporabi accurate (Gemini Pro).
  // Za ostale jezike "mode" itak ni bil relevanten.

  // Pošlji trajanje snemanja za natančno beleženje porabe
  if (durationSeconds !== undefined && durationSeconds > 0) {
    body.duration_seconds = durationSeconds;
  }

  let data: any;
  let error: any;

  const timeoutMs = isSlovenian ? TIMEOUT_ACCURATE_MS : TIMEOUT_FAST_MS;

  try {
    const result = await withTimeout(
      supabase.functions.invoke("voice-to-text", { body }),
      timeoutMs
    );
    data = result.data;
    error = result.error;
  } catch (err: any) {
    if (err instanceof DictationError && err.type === "timeout") {
      throw err; // re-throw timeout as-is
    }
    throw classifyError(err, null);
  }

  if (error) {
    throw classifyError(error, data);
  }
  if (!data || !data.text) {
    // No transcript returned — could be quota issue (backend returned empty)
    if (data && (data.error || data.message)) {
      throw classifyError({ message: data.error || data.message }, data);
    }
    // Prej napačno klasificirano kot "quota" — prazen odgovor je strežniška
    // napaka, ne prekoračena kvota. Napačno sporočilo je uporabnike begalo.
    throw new DictationError("Ni prejetega transkripta od strežnika.", "generic");
  }

  const rawTranscript = data.text as string;

  // OPOMBA: Ločen klic "proofread-text" za SL + accurate je ODSTRANJEN.
  // Backend (voice-to-text) za SL accurate način že uporablja združen
  // Gemini Pro prompt, ki transkribira IN lektorira v enem klicu.
  // Dodaten proofread klic je le podvajal delo, podaljšal čakanje
  // in dodal še eno možno točko odpovedi.

  // ── Vrni transkript (backend že vrne lektorirano besedilo za SL accurate) ──
  return {
    raw_transcript: rawTranscript,
    final_text: rawTranscript,
  };
}
