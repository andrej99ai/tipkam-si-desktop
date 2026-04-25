let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let recordingStartTime: number = 0;

export function startRecording(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
    if (!mediaRecorder) {
      reject(new Error("Snemanje ni aktivno."));
      return;
    }
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
