import { supabase } from "./supabase";

export type DictationMode = "fast" | "accurate";

export interface DictationResult {
  raw_transcript: string;
  final_text: string;
}

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
  languageCode: string = "sl"
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

  const { data, error } = await supabase.functions.invoke("voice-to-text", {
    body,
  });

  if (error) {
    throw new Error(`Napaka pri transkripciji: ${error.message}`);
  }
  if (!data || !data.text) {
    throw new Error("Ni prejetega transkripta od strežnika.");
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
