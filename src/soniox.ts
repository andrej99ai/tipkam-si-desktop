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
  /** Mikrofon odklopljen/utišan ALI povezava prekinjena med sejo (fatalno) */
  onDisconnect?: () => void;
  /** 15 s brez novih tokenov — nemodalno opozorilo, seje NE ustavimo */
  onSilence?: () => void;
  /** Prvi token po opozorilu — skrij opozorilo */
  onSound?: () => void;
  /**
   * Zajem zvoka teče (mikrofon odprt, vzorci se shranjujejo v predpomnilnik).
   * Od tega trenutka uporabnik lahko VARNO govori — nič se ne izgubi, tudi
   * če WebSocket povezava še ni vzpostavljena. UI naj tu pokaže rdeče stanje.
   */
  onCaptureStarted?: () => void;
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

  // ── Silence watchdog (token-based) ──
  private silenceTimer: ReturnType<typeof setInterval> | null = null;
  private lastTokenTime = 0;
  private silenceWarned = false;
  private static readonly SILENCE_WINDOW_MS = 15_000;

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
    // 1. Open microphone FIRST — before any async network calls.
    //    Chromium/WebView2 requires the getUserMedia call to happen within
    //    the "user activation" window (the brief period after a key/click event).
    //    If we await a network request first, that window expires and WebView2
    //    rejects the getUserMedia call even when permission was already granted.
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    try {
      await this.setupAfterMic();
    } catch (err) {
      // If anything fails after we have the mic, release EVERYTHING cleanly
      // (zajem zdaj steče pred povezovanjem, zato je treba pospraviti tudi
      // audio verigo in morebitni napol odprt WebSocket).
      this.isStopping = true;
      try { this.processor?.disconnect(); } catch (_) { /* */ }
      try { this.source?.disconnect(); } catch (_) { /* */ }
      try { this.audioContext?.close(); } catch (_) { /* */ }
      try { this.ws?.close(); } catch (_) { /* */ }
      this.processor = null;
      this.source = null;
      this.audioContext = null;
      this.ws = null;
      this.preBuffer = [];
      this.preBufferedBytes = 0;
      try { this.stream.getTracks().forEach((t) => t.stop()); } catch (_) { /* */ }
      this.stream = null;
      throw err;
    }
  }

  // ── Pre-buffer: zvok, zajet preden je WebSocket pripravljen ──
  private preBuffer: ArrayBuffer[] = [];
  private preBufferedBytes = 0;
  /** Varnostna kapica: 60 s Int16 @ 16 kHz (če se povezava nikoli ne vzpostavi) */
  private static readonly PRE_BUFFER_MAX_BYTES = 2 * 16000 * 60;
  /** true šele, ko je config poslan in je predpomnilnik izpraznjen */
  private streamingLive = false;

  /** All setup steps that follow after the microphone stream is acquired. */
  private async setupAfterMic(): Promise<void> {
    // 2. Začni ZAJEM TAKOJ — vsak vzorec od tega trenutka gre v predpomnilnik,
    //    dokler WebSocket ni pripravljen. Uporabnik lahko govori takoj po
    //    rdečem indikatorju; prve besede se NE izgubijo več.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    this.audioContext = new AC({ sampleRate: 16000 });
    const actualRate = this.audioContext.sampleRate;

    //    Buffer size 2048 = ~128 ms @16 kHz — good latency vs. overhead balance.
    this.source = this.audioContext.createMediaStreamSource(this.stream!);
    this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (this.isStopping) return;

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

      if (this.streamingLive && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(int16.buffer);
      } else if (this.preBufferedBytes < SonioxSession.PRE_BUFFER_MAX_BYTES) {
        // Povezava še ni pripravljena — shrani za kasnejši flush
        this.preBuffer.push(int16.buffer);
        this.preBufferedBytes += int16.buffer.byteLength;
      }
    };

    this.source.connect(this.processor);
    // Connect to destination (required for ScriptProcessorNode to fire)
    this.processor.connect(this.audioContext.destination);

    this.durationStartTime = Date.now();
    // UI lahko pokaže rdeče stanje — od tu naprej se nič ne izgubi
    this.callbacks.onCaptureStarted?.();

    // 3. VZPOREDNO: temp key (validira tudi kvoto) + odpiranje WebSocketa.
    //    Prej je bilo zaporedno (~0,5 s + ~0,3 s); vzporedno prihrani ~0,3-0,5 s.
    const keyPromise = supabase.functions.invoke("soniox-temp-key", { body: {} });

    this.ws = new WebSocket("wss://stt-rt.soniox.com/transcribe-websocket");
    const wsOpenPromise = new Promise<void>((resolve, reject) => {
      this.ws!.onopen = () => resolve();
      this.ws!.onerror = () =>
        reject(
          new DictationError("WebSocket connection to Soniox failed", "generic")
        );
    });

    const [keyResult] = await Promise.all([keyPromise, wsOpenPromise]);
    const { data, error } = keyResult;
    if (error || !data?.api_key) {
      throw classifySonioxKeyError(error, data);
    }
    const tempKey = data.api_key as string;

    // 4. Send config (text frame)
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

    // 5. Message handler
    this.ws.onmessage = (e) => this.handleMessage(e);
    this.ws.onerror = () => {
      // Non-fatal mid-session WS error — log only; onmessage handles error responses
      console.warn("[Soniox] WebSocket error during live session");
    };

    // 6. Izprazni predpomnilnik — pošlji ves zvok, zajet med vzpostavljanjem
    for (const buf of this.preBuffer) {
      this.ws.send(buf);
    }
    this.preBuffer = [];
    this.preBufferedBytes = 0;
    this.streamingLive = true;

    // 7. Active monitoring: mic fizično odklopljen / sistemsko utišan
    const micTrack = this.stream!.getAudioTracks()[0];
    if (micTrack) {
      micTrack.onended = () => this.fireDisconnect();
      micTrack.onmute = () => this.fireDisconnect();
    }

    // 9. WebSocket nepričakovano zaprtje med sejo (koda != 1000 = napaka)
    this.ws.onclose = (e: CloseEvent) => {
      if (this.isStopping) return; // pričakovano zaprtje ob stop()
      if (e.code !== 1000) this.fireDisconnect();
    };

    // 10. Silence watchdog — vsako sekundo preveri, ali so prihajali tokeni.
    //     Seje NE ustavljamo (uporabnik morda samo razmišlja), le opozorimo.
    this.lastTokenTime = Date.now();
    this.silenceTimer = setInterval(() => {
      if (this.isStopping) return;
      const quiet = Date.now() - this.lastTokenTime > SonioxSession.SILENCE_WINDOW_MS;
      if (quiet && !this.silenceWarned) {
        this.silenceWarned = true;
        this.callbacks.onSilence?.();
      }
    }, 1000);
    // (durationStartTime je nastavljen že ob začetku zajema — korak 2)
  }

  /** Enkratni sprožilec za fatalno prekinitev (mic/WS). Idempotenten. */
  private disconnectFired = false;
  private fireDisconnect() {
    if (this.disconnectFired || this.isStopping) return;
    this.disconnectFired = true;
    this.callbacks.onDisconnect?.();
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

    // 0. Ustavi silence watchdog
    if (this.silenceTimer !== null) {
      clearInterval(this.silenceTimer);
      this.silenceTimer = null;
    }

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

      // Reset silence watchdog ob vsakem dejanskem (ne-praznem) tokenu
      if (newFinal.trim() || newNonFinal.trim()) {
        this.lastTokenTime = Date.now();
        if (this.silenceWarned) {
          this.silenceWarned = false;
          this.callbacks.onSound?.();
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
      .replace(/,\s+(in)\b/gi, " $1")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([.,!;:?])/g, "$1")
      .trim();
  }
}
