let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let recordingStartTime: number = 0;

/** Optional active-monitoring hooks for a recording session */
export interface RecorderMonitor {
  /** Mikrofon fizično odklopljen ali sistemsko utišan med snemanjem */
  onLost?: () => void;
  /** Sproži se, ko v zadnjih `silenceMs` ni bilo zaznanega zvoka (RMS < prag) */
  onSilence?: () => void;
  /** Sproži se ob prvem zaznanem zvoku po opozorilu (za skritje opozorila) */
  onSound?: () => void;
}

// ── Audio-level (RMS) watchdog state ──────────────────────────────────────────
let levelContext: AudioContext | null = null;
let levelTimer: ReturnType<typeof setInterval> | null = null;
const SILENCE_RMS_THRESHOLD = 0.02;
const SILENCE_WINDOW_MS = 15_000;

function teardownLevelMonitor() {
  if (levelTimer !== null) {
    clearInterval(levelTimer);
    levelTimer = null;
  }
  if (levelContext) {
    try { levelContext.close(); } catch (_) { /* */ }
    levelContext = null;
  }
}

function setupLevelMonitor(stream: MediaStream, monitor: RecorderMonitor) {
  if (!monitor.onSilence && !monitor.onSound) return;
  try {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    levelContext = new AC();
    const source = levelContext.createMediaStreamSource(stream);
    const analyser = levelContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    let lastSoundTime = Date.now();
    let warned = false;

    levelTimer = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);

      if (rms >= SILENCE_RMS_THRESHOLD) {
        lastSoundTime = Date.now();
        if (warned) {
          warned = false;
          monitor.onSound?.();
        }
      } else if (!warned && Date.now() - lastSoundTime > SILENCE_WINDOW_MS) {
        warned = true;
        monitor.onSilence?.();
      }
    }, 1000);
  } catch (_) {
    // Analyser ni na voljo — RMS watchdog je samo dodatna zaščita, ne blokiramo.
  }
}

export function startRecording(monitor?: RecorderMonitor): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Active monitoring: mic fizično odklopljen / sistemsko utišan
      if (monitor?.onLost) {
        const track = stream.getAudioTracks()[0];
        if (track) {
          track.onended = () => monitor.onLost?.();
          track.onmute = () => monitor.onLost?.();
        }
      }
      if (monitor) setupLevelMonitor(stream, monitor);

      mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      // Wait until MediaRecorder actually starts capturing before showing red indicator
      mediaRecorder.onstart = () => {
        recordingStartTime = Date.now();
        resolve();
      };
      mediaRecorder.start();
    } catch (err) {
      reject(err);
    }
  });
}

export interface RecordingResult {
  audioBase64: string;
  durationSeconds: number;
}

export function stopRecording(): Promise<RecordingResult> {
  return new Promise((resolve, reject) => {
    teardownLevelMonitor();
    if (!mediaRecorder) {
      reject(new Error("Snemanje ni aktivno."));
      return;
    }
    // Odstrani onended/onmute PRED ustavitvijo — sicer track.stop() spodaj
    // sproži onended in bi se "mic disconnected" javil ob vsakem normalnem stopu.
    mediaRecorder.stream.getAudioTracks().forEach((tr) => {
      tr.onended = null;
      tr.onmute = null;
    });
    const durationSeconds = Math.round(((Date.now() - recordingStartTime) / 1000) * 10) / 10;
    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve({ audioBase64: base64, durationSeconds });
      };
      reader.onerror = () => reject(new Error("Napaka pri branju posnetka."));
      reader.readAsDataURL(blob);
      // Stop all tracks to release microphone
      mediaRecorder!.stream.getTracks().forEach((t) => t.stop());
    };
    mediaRecorder.stop();
  });
}

export function isRecording(): boolean {
  return mediaRecorder?.state === "recording";
}
