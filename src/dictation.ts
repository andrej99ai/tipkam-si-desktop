import { supabase } from "./supabase";

export type DictationMode = "fast" | "accurate";

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

const TRANSCRIPTION_TIMEOUT_MS = 60_000; // 60 seconds

/**
 * Pošlje avdio na Supabase Edge Function za transkripcijo.
 *
 * Tok:
 * 1. Kliče "voice-to-text" Edge Function z audio, mime_type, language_code, mode
 * 2. Za slovenščino + "accurate" način dodatno kliče "proofread-text" za lektoriranje
 *
 * Logika izbire modela (v Edge Function):
 * - language_code = "sl" + mode != "fast" → Gemini 2.5 Pro
 * - language_code = "sl" + mode = "fast"  → Gemini 2.5 Flash
 * - Vsi ostali jeziki                     → Gemini 2.5 Flash
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

  // Pošlji "mode" samo za slovenščino (za ostale jezike ni relevantno)
  if (isSlovenian && mode === "fast") {
    body.mode = "fast";
  }
  // Za slovenščino brez "mode" = accurate (privzeto v Edge Function)

  // Pošlji trajanje snemanja za natančno beleženje porabe
  if (durationSeconds !== undefined && durationSeconds > 0) {
    body.duration_seconds = durationSeconds;
  }

  let data: any;
  let error: any;

  try {
    const result = await withTimeout(
      supabase.functions.invoke("voice-to-text", { body }),
      TRANSCRIPTION_TIMEOUT_MS
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
    throw new DictationError("Ni prejetega transkripta od strežnika.", "quota");
  }

  const rawTranscript = data.text as string;

  // ── Korak 2: Lektoriranje (samo za SL + accurate) ──
  if (isSlovenian && mode === "accurate") {
    try {
      const { data: proofData, error: proofError } =
        await supabase.functions.invoke("proofread-text", {
          body: {
            text: rawTranscript,
          },
        });

      if (!proofError && proofData && proofData.text) {
        return {
          raw_transcript: rawTranscript,
          final_text: proofData.text as string,
        };
      }
    } catch (e) {
      // Če lektoriranje ne uspe, vrni surovi transkript
      console.warn("Proofread failed, using raw transcript:", e);
    }
  }

  // ── Za "fast" način ali druge jezike: vrni surovi transkript ──
  return {
    raw_transcript: rawTranscript,
    final_text: rawTranscript,
  };
}
