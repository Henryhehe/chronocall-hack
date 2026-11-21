export function float32ToPcm16Base64(float32: Float32Array, inputSampleRate = 16000): string {
  let samples = float32;
  if (inputSampleRate !== 16000 && inputSampleRate > 0) {
    const ratio = inputSampleRate / 16000;
    const outLen = Math.max(1, Math.round(float32.length / ratio));
    const resampled = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const pos = i * ratio;
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const s0 = float32[Math.min(idx, float32.length - 1)];
      const s1 = float32[Math.min(idx + 1, float32.length - 1)];
      resampled[i] = s0 + (s1 - s0) * frac;
    }
    samples = resampled;
  }

  const pcm16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function pcm24kBase64ToAudioBuffer(
  ctx: AudioContext,
  base64: string
): AudioBuffer {
  const bytes = base64ToUint8Array(base64);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const buffer = ctx.createBuffer(1, sampleCount, 24000);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) {
    channel[i] = view.getInt16(i * 2, true) / 32768;
  }
  return buffer;
}

export function computeAnalyserEnergy(analyser: AnalyserNode | null): number {
  if (!analyser) return 0;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(data);
  let sumSq = 0;
  for (let i = 0; i < data.length; i++) {
    const norm = (data[i] - 128) / 128;
    sumSq += norm * norm;
  }
  const rms = Math.sqrt(sumSq / data.length);
  return Math.min(1, rms * 3.8);
}
