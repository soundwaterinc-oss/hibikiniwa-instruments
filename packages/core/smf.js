// Standard MIDI File（フォーマット1）の書き出し。依存なし
// writeSmf({ ppq, bpm, timeSig:[4,4], tracks:[{ name, ch, notes:[{ tick, dur, note, vel }] }] }) → Uint8Array

function vlq(n) {
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
}
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n) => [(n >>> 8) & 255, n & 255];
const text = (s) => [...new TextEncoder().encode(s)];

function chunk(type, bytes) { return [...text(type), ...u32(bytes.length), ...bytes]; }

function trackBytes(events) {
  // events: [{ tick, data:[...] }]（同時刻は note off を先に）
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const out = [];
  let last = 0;
  for (const e of events) { out.push(...vlq(Math.max(0, e.tick - last)), ...e.data); last = e.tick; }
  out.push(0x00, 0xff, 0x2f, 0x00); // end of track
  return out;
}

export function writeSmf({ ppq = 480, bpm = 120, timeSig = [4, 4], tracks = [] }) {
  const usPerQ = Math.round(60e6 / bpm);
  const conductor = trackBytes([
    { tick: 0, order: 0, data: [0xff, 0x03, ...vlq(text('HIBIKINIWA').length), ...text('HIBIKINIWA')] },
    { tick: 0, order: 1, data: [0xff, 0x51, 0x03, (usPerQ >> 16) & 255, (usPerQ >> 8) & 255, usPerQ & 255] },
    { tick: 0, order: 2, data: [0xff, 0x58, 0x04, timeSig[0], Math.log2(timeSig[1]), 24, 8] },
  ]);
  const chunks = [chunk('MThd', [...u16(1), ...u16(tracks.length + 1), ...u16(ppq)]), chunk('MTrk', conductor)];
  for (const t of tracks) {
    const ch = (t.ch ?? 0) & 15;
    const ev = [{ tick: 0, order: -1, data: [0xff, 0x03, ...vlq(text(t.name || '').length), ...text(t.name || '')] }];
    for (const n of t.notes) {
      const note = Math.max(0, Math.min(127, Math.round(n.note)));
      const vel = Math.max(1, Math.min(127, Math.round(n.vel)));
      ev.push({ tick: Math.round(n.tick), order: 1, data: [0x90 | ch, note, vel] });
      ev.push({ tick: Math.round(n.tick + Math.max(1, n.dur)), order: 0, data: [0x80 | ch, note, 0] });
    }
    chunks.push(chunk('MTrk', trackBytes(ev)));
  }
  return new Uint8Array(chunks.flat());
}

// 読み戻し（テスト用の最小限）：ヘッダーとトラック数
export function readSmfHeader(bytes) {
  const s = String.fromCharCode(...bytes.slice(0, 4));
  const dv = new DataView(bytes.buffer, bytes.byteOffset);
  return { magic: s, length: dv.getUint32(4), format: dv.getUint16(8), tracks: dv.getUint16(10), division: dv.getUint16(12) };
}
