// WAV（リニアPCM）の書き出しと、MediaRecorder によるマスター出力の録音

// channels: Float32Array[]（同じ長さ）→ Uint8Array（RIFF/WAVE, PCM 16bit 既定）
export function encodeWav(channels, sampleRate, bits = 16) {
  const nch = channels.length, len = channels[0].length;
  const bps = bits / 8, block = nch * bps, dataLen = len * block;
  const buf = new ArrayBuffer(44 + dataLen);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nch, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * block, true); v.setUint16(32, block, true); v.setUint16(34, bits, true);
  str(36, 'data'); v.setUint32(40, dataLen, true);
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < nch; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i] || 0));
      if (bits === 16) { v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
      else { const x = Math.round(s < 0 ? s * 0x800000 : s * 0x7fffff); v.setUint8(o, x & 255); v.setUint8(o + 1, (x >> 8) & 255); v.setUint8(o + 2, (x >> 16) & 255); o += 3; }
    }
  }
  return new Uint8Array(buf);
}

export const audioBufferToWav = (ab, bits = 16) =>
  encodeWav(Array.from({ length: ab.numberOfChannels }, (_, c) => ab.getChannelData(c)), ab.sampleRate, bits);

// ブラウザでファイルとして保存
export function saveBytes(bytes, name, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// マスター出力の録音。MediaRecorder（webm/opus など）で録り、停止時にデコードしてWAVへ変換する
export function createRecorder(ctx, node) {
  let rec = null, chunks = [], dest = null, startedAt = 0;
  return {
    get recording() { return !!rec; },
    get elapsed() { return rec ? (performance.now() - startedAt) / 1000 : 0; },
    start() {
      if (rec || typeof MediaRecorder === 'undefined') return false;
      dest = ctx.createMediaStreamDestination();
      node.connect(dest);
      chunks = [];
      rec = new MediaRecorder(dest.stream);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.start(250);
      startedAt = performance.now();
      return true;
    },
    // 戻り値：WAV の Uint8Array
    stop() {
      return new Promise((resolve, reject) => {
        if (!rec) return resolve(null);
        rec.onstop = async () => {
          try {
            node.disconnect(dest);
            const blob = new Blob(chunks, { type: rec.mimeType });
            rec = null;
            const ab = await ctx.decodeAudioData(await blob.arrayBuffer());
            resolve(audioBufferToWav(ab));
          } catch (e) { rec = null; reject(e); }
        };
        rec.stop();
      });
    },
  };
}
