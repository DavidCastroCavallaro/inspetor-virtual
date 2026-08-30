// Gravacao de voz curta e objetiva (economia Whisper).
import { blobToBase64 } from './image.js';

export class VoiceRecorder {
  constructor() {
    this.rec = null;
    this.chunks = [];
    this.stream = null;
  }

  get supported() {
    return typeof window !== 'undefined' && 'MediaRecorder' in window;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start();
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.rec) return resolve(null);
      this.rec.onstop = async () => {
        const blob = new Blob(this.chunks, { type: this.rec.mimeType || 'audio/webm' });
        this.stream?.getTracks().forEach((t) => t.stop());
        resolve({
          blob,
          mime: blob.type || 'audio/webm',
          base64: await blobToBase64(blob),
          seconds: 0,
        });
      };
      this.rec.stop();
    });
  }
}
