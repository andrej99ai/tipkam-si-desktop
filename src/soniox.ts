/**
 * Soniox real-time speech-to-text via WebSocket.
 *
 * Flow:
 *  1. Fetch a short-lived temp key from `soniox-temp-key` Edge Function
 *     (also validates user quota — throws DictationError("quota") on 429).
 *  2. Open AudioContext at 16 kHz + getUserMedia.
 *  3. Open WebSocket to wss://stt-rt.soniox.com/transcribe-websocket.
 *  4. Send config message (model, language hints, etc.).
 *  5. Stream raw PCM (Int16, 16 kHz mono) as binary WebSocket frames.
 *  6. Receive token messages → update finalText + nonFinalPreview.
 *  7. On stop():
 *     a. Halt audio chain.
 *     b. Send { type: "finalize" } → wait for <fin> marker (max 3 s).
 *     c. Close WebSocket + AudioContext.
 *     d. Return post-processed final text + duration.
 */

import { supabase } from "./supabase";
import { DictationError } from "./dictation";

// ─── Public interface ────────────────────────────────────────────────────────

export interface SonioxCallbacks {
  /** Called with the full current transcript text (final + partial preview) */
  onTranscriptUpdate: (text: string) => void;
}

// ─── Error classification ────────────────────────────────────────────────────

function classifySonioxKeyError(error: any, data: any): DictationError {
  const msg = String(
    error?.message ?? data?.error ?? data?.message ?? ""
  ).toLowerCase();

  // Auth / expired
  if (
    msg.includes("401") ||
    msg.includes("unauthorized") ||
    msg.includes("jwt") ||
    msg.includes("auth") ||
    msg.includes("token") ||
    msg.includes("expired")
  ) {
    return new DictationError(msg || "Session expired", "auth");
  }

  // Quota / limit
  if (
    msg.includes("429") ||
    msg.includes("limit") ||
    msg.includes("quota") ||
    msg.includes("exceeded") ||
    msg.includes("upgrade") ||
    msg.includes("presegel") ||
    msg.includes("nadgrad")
  ) {
    return new DictationError(msg || "Quota exceeded", "quota");
  }

  return new DictationError(
    error?.message || data?.error || "Failed to start live session",
    "generic"
  );
}

// ─── SonioxSession ───────────────────────────────────────────────────────────

export class SonioxSession {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  private finalText = "";
  private nonFinalPreview = "";
  private durationStartTime = 0;
  private isStopping = false;

  /** Resolved when <fin> marker arrives (manual finalize signal) */
  private finResolve: (() => void) | null = null;

  private callbacks: SonioxCallbacks;

  constructor(callbacks: SonioxCallbacks) {
    this.callbacks = callbacks;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Fetches temp key, opens mic + WebSocket, starts streaming PCM.
   * Throws DictationError (quota / auth / generic) on failure.
   */
  async start(): Promise<void> {
    // 1. Fetch ephemeral Soniox key (checks user quota too)
    const { data, error } = await supabase.functions.invoke("soniox-temp-key", {
      body: {},
    });

    if (error || !data?.api_key) {
      throw classifySonioxKeyError(error, data);
    }
    const tempKey = data.api_key as string;

    // 2. Open microphone
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // 3. AudioContext — request 16 kHz (Soniox requirement)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    this.audioContext = new AC({ sampleRate: 16000 });
    const actualRate = this.audioContext.sampleRate;

    // 4. Open WebSocket
    this.ws = new WebSocket("wss://stt-rt.soniox.com/transcribe-websocket");

    await new Promise<void>((resolve, reject) => {
      this.ws!.onopen = () => resolve();
      this.ws!.onerror = () =>
        reject(
          new DictationError("WebSocket connection to Soniox failed", "generic")
        );
    });

    // 5. Send config (text frame)
    this.ws.send(
      JSON.stringify({
        api_key: tempKey,
        model: "stt-rt-preview",
        audio_format: "pcm_s16le",
        sample_rate: 16000,
        num_channels: 1,
        language_hints: ["sl"],
        language_hints_strict: true,
        enable_endpoint_detection: false, // must be false — avoids unwanted <end> tokens
      })
    );

    // 6. Message handler
    this.ws.onmessage = (e) => this.handleMessage(e);
    this.ws.onerror = () => {
      // Non-fatal mid-session WS error — log only; onmessage handles error responses
      console.warn("[Soniox] WebSocket error during live session");
    };

    // 7. Start streaming PCM via ScriptProcessorNode
    //    Buffer size 2048 = ~128 ms @16 kHz — good latency vs. overhead balance.
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (this.isStopping || this.ws?.readyState !== WebSocket.OPEN) return;

      // getChannelData returns Float32Array<ArrayBufferLike>; copy to a plain
      // Float32Array<ArrayBuffer> so the resample helper types stay compatible.
      let samples: Float32Array = new Float32Array(e.inputBuffer.getChannelData(0));

      // Resample to 16 kHz if the OS returned a different rate
      if (actualRate !== 16000) {
        samples = this.resample(samples, actualRate, 16000);
      }

      // Float32 → Int16 PCM little-endian
      const int16 = new Int16Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        int16[i] = s < 0 ? s * 32768 : s * 32767;
      }

      this.ws!.send(int16.buffer);
    };

    this.source.connect(this.processor);
    // Connect to destination (required for ScriptProcessorNode to fire)
    this.processor.connect(this.audioContext.destination);

    this.durationStartTime = Date.now();
  }

  /**
   * Stops the session:
   * 1. Halts mic + audio chain.
   * 2. Sends "finalize" to Soniox (converts pending non-final tokens → final).
   * 3. Waits up to 3 s for the <fin> marker.
   * 4. Closes WebSocket + AudioContext.
   * 5. Returns post-processed text + duration.
   */
  async stop(): Promise<{ text: string; durationSeconds: number }> {
    this.isStopping = true;
    const durationSeconds =
      Math.round(((Date.now() - this.durationStartTime) / 1000) * 10) / 10;

    // 1. Stop audio chain (stop sending PCM)
    try { this.source?.disconnect(); } catch (_) { /* */ }
    try { this.processor?.disconnect(); } catch (_) { /* */ }
    try { this.stream?.getTracks().forEach((t) => t.stop()); } catch (_) { /* */ }

    // 2. Finalize + wait for <fin> marker
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: "finalize" }));

        // Wait for <fin> token — or 3 s safety timeout
        await Promise.race([
          new Promise<void>((resolve) => {
            this.finResolve = resolve;
          }),
          new Promise<void>((resolve) => setTimeout(resolve, 3000)),
        ]);
      } catch (_) { /* */ }

      try { this.ws.close(); } catch (_) { /* */ }
    }

    // 3. Close AudioContext
    try { await this.audioContext?.close(); } catch (_) { /* */ }

    // 4. Post-process and return
    const raw = (this.finalText + this.nonFinalPreview).trim();
    return {
      text: this.postProcess(raw),
      durationSeconds,
    };
  }

  /** Returns the live display text (final + partial preview) */
  getCurrentText(): string {
    return (this.finalText + this.nonFinalPreview).trim();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private handleMessage(event: MessageEvent) {
    try {
      const msg = JSON.parse(event.data as string);

      // Server-side error
      if (msg.error_code) {
        console.warn("[Soniox] Server error:", msg.error_code, msg.error_message);
        return;
      }

      if (!Array.isArray(msg.tokens)) return;

      let newFinal = "";
      let newNonFinal = "";
      let hasFinMarker = false;

      for (const token of msg.tokens) {
        const txt = token.text as string;

        // Skip control markers like <end>, <fin>
        if (/^<[^>]+>$/.test(txt)) {
          if (txt === "<fin>") hasFinMarker = true;
          continue;
        }

        if (token.is_final) {
          newFinal += txt;
        } else {
          newNonFinal += txt;
        }
      }

      if (newFinal) this.finalText += newFinal;
      this.nonFinalPreview = newNonFinal;

      const display = (this.finalText + this.nonFinalPreview).trim();
      this.callbacks.onTranscriptUpdate(display);

      // If <fin> arrived and stop() is waiting for it, resolve the promise
      if (hasFinMarker && this.finResolve) {
        this.finResolve();
        this.finResolve = null;
      }
    } catch (e) {
      console.warn("[Soniox] Message parse error:", e);
    }
  }

  /** Linear interpolation resampler for cases where OS sample rate ≠ 16 kHz */
  private resample(
    samples: Float32Array,
    fromRate: number,
    toRate: number
  ): Float32Array {
    const ratio = fromRate / toRate;
    const newLen = Math.ceil(samples.length / ratio);
    const result = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const pos = i * ratio;
      const idx0 = Math.floor(pos);
      const idx1 = Math.min(idx0 + 1, samples.length - 1);
      const frac = pos - idx0;
      result[i] = samples[idx0] * (1 - frac) + samples[idx1] * frac;
    }
    return result;
  }

  /**
   * Slovenian post-processing rules (same as web version):
   * - Remove comma before "in"
   * - Collapse multiple spaces
   * - Remove space before punctuation
   */
  private postProcess(text: string): string {
    return text
      .replace(/,\s+(in)\b/gi, " $1")   // ,in → in
      .replace(/\s{2,}/g, " ")           // multiple spaces → one
      .replace(/\s+([.,!;:?])/g, "$1")  // space before punctuation → none
      .trim();
  }
}
