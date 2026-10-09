// HYPOGEUM // KKR-40 — 世界の民族音階ライブラリ（表示コードは codebook.js）
// すべてセント値（1オクターブ=1200c, 起点=0）で保持する。
// tuning: "12-TET" | "just" | "24-TET" | "53-TET" | "measured(approx)" など出典の調律系
// 実測系（ガムラン・ムビラ等）は楽団・地域ごとに大きく異なるため代表値の近似。

const C = 1200 / 53; // トルコ古典音楽のコンマ（Holdrian comma）≈ 22.64c
const fromCommas = (arr) => arr.map((n) => +(n * C).toFixed(1));
const r = (num, den) => +(1200 * Math.log2(num / den)).toFixed(1);
const edo = (n, steps = n) => Array.from({ length: steps }, (_, i) => +((1200 / n) * i).toFixed(1));

// 22シュルティ系の純正比（ヒンドゥスターニー）
const S = {
  Sa: 0, re: r(16, 15), Re: r(9, 8), ga: r(6, 5), Ga: r(5, 4), Ma: r(4, 3),
  MaT: r(45, 32), Pa: r(3, 2), dha: r(8, 5), Dha: r(5, 3), ni: r(9, 5), Ni: r(15, 8),
};

export const SCALES = [
  // ── 日本・琉球 ─────────────────────────────
  { id: 'ryukyu', region: '日本・琉球', name: '琉球音階', tuning: '12-TET', cents: [0, 400, 500, 700, 1100],
    labels: ['ド', 'ミ', 'ファ', 'ソ', 'シ'], note: '沖縄民謡の基本音階。2・6度を抜いた5音。' },
  { id: 'ryukyu-just', region: '日本・琉球', name: '琉球音階（純正律）', tuning: 'just',
    cents: [0, r(5, 4), r(4, 3), r(3, 2), r(15, 8)], labels: ['1/1', '5/4', '4/3', '3/2', '15/8'],
    note: '琉球音階を5-limit純正比で。長3度・長7度のうなりが消え、ドローンと溶け合う。' },
  { id: 'minyo', region: '日本・琉球', name: '民謡音階', tuning: '12-TET', cents: [0, 300, 500, 700, 1000], note: '小泉文夫の4分類のひとつ。' },
  { id: 'miyakobushi', region: '日本・琉球', name: '都節音階（陰音階）', tuning: '12-TET', cents: [0, 100, 500, 700, 800], note: '箏曲・三味線音楽。' },
  { id: 'yo', region: '日本・琉球', name: '陽音階（律）', tuning: '12-TET', cents: [0, 200, 500, 700, 900] },
  { id: 'hirajoshi', region: '日本・琉球', name: '平調子', tuning: '12-TET', cents: [0, 200, 300, 700, 800], note: '箏の代表的な調弦。' },
  { id: 'kumoi', region: '日本・琉球', name: '雲井調子', tuning: '12-TET', cents: [0, 200, 300, 700, 900] },
  { id: 'iwato', region: '日本・琉球', name: '岩戸調子', tuning: '12-TET', cents: [0, 100, 500, 600, 1000] },

  // ── インド（ラーガ / 純正シュルティ）────────────
  { id: 'yaman', region: 'インド・ラーガ', name: 'ヤマン（Kalyan）', tuning: 'just',
    cents: [S.Sa, S.Re, S.Ga, S.MaT, S.Pa, S.Dha, S.Ni], labels: ['Sa', 'Re', 'Ga', 'Ma♯', 'Pa', 'Dha', 'Ni'], note: '夕刻のラーガ。' },
  { id: 'bhairav', region: 'インド・ラーガ', name: 'バイラヴ', tuning: 'just',
    cents: [S.Sa, S.re, S.Ga, S.Ma, S.Pa, S.dha, S.Ni], labels: ['Sa', 're', 'Ga', 'Ma', 'Pa', 'dha', 'Ni'], note: '夜明けのラーガ。' },
  { id: 'bhairavi', region: 'インド・ラーガ', name: 'バイラヴィ', tuning: 'just',
    cents: [S.Sa, S.re, S.ga, S.Ma, S.Pa, S.dha, S.ni], labels: ['Sa', 're', 'ga', 'Ma', 'Pa', 'dha', 'ni'] },
  { id: 'todi', region: 'インド・ラーガ', name: 'トーディ', tuning: 'just',
    cents: [S.Sa, S.re, S.ga, S.MaT, S.Pa, S.dha, S.Ni], labels: ['Sa', 're', 'ga', 'Ma♯', 'Pa', 'dha', 'Ni'] },
  { id: 'marwa', region: 'インド・ラーガ', name: 'マールワー（Pa抜き）', tuning: 'just',
    cents: [S.Sa, S.re, S.Ga, S.MaT, S.Dha, S.Ni], labels: ['Sa', 're', 'Ga', 'Ma♯', 'Dha', 'Ni'], note: 'Paを欠く黄昏のラーガ。タンプーラはMa♯やNiに合わせる。' },
  { id: 'bhupali', region: 'インド・ラーガ', name: 'ブーパーリー', tuning: 'just',
    cents: [S.Sa, S.Re, S.Ga, S.Pa, S.Dha], labels: ['Sa', 'Re', 'Ga', 'Pa', 'Dha'] },
  { id: 'malkauns', region: 'インド・ラーガ', name: 'マールカウンス', tuning: 'just',
    cents: [S.Sa, S.ga, S.Ma, S.dha, S.ni], labels: ['Sa', 'ga', 'Ma', 'dha', 'ni'], note: '深夜のラーガ。' },
  { id: 'kafi', region: 'インド・ラーガ', name: 'カーフィー', tuning: 'just',
    cents: [S.Sa, S.Re, S.ga, S.Ma, S.Pa, S.Dha, S.ni], labels: ['Sa', 'Re', 'ga', 'Ma', 'Pa', 'Dha', 'ni'] },

  // ── アラブ・マカーム（24平均律近似）──────────────
  { id: 'rast', region: 'アラブ・マカーム', name: 'ラースト', tuning: '24-TET', cents: [0, 200, 350, 500, 700, 900, 1050], note: '中立3度（350c）を含む。' },
  { id: 'bayati', region: 'アラブ・マカーム', name: 'バヤーティー', tuning: '24-TET', cents: [0, 150, 300, 500, 700, 800, 1000] },
  { id: 'hijaz', region: 'アラブ・マカーム', name: 'ヒジャーズ', tuning: '24-TET', cents: [0, 100, 400, 500, 700, 800, 1000] },
  { id: 'saba', region: 'アラブ・マカーム', name: 'サバー', tuning: '24-TET', cents: [0, 150, 300, 400, 700, 800, 1000], note: '哀切のマカーム。減4度が特徴。' },
  { id: 'sikah', region: 'アラブ・マカーム', name: 'スィーカー', tuning: '24-TET', cents: [0, 150, 350, 550, 700, 850, 1050] },
  { id: 'kurd', region: 'アラブ・マカーム', name: 'クルド', tuning: '24-TET', cents: [0, 100, 300, 500, 700, 800, 1000] },
  { id: 'nahawand', region: 'アラブ・マカーム', name: 'ナハーワンド', tuning: '24-TET', cents: [0, 200, 300, 500, 700, 800, 1000] },

  // ── トルコ・マカーム（53コンマ）─────────────────
  { id: 'ussak', region: 'トルコ・マカーム', name: 'ウッシャク', tuning: '53-TET', cents: fromCommas([0, 8, 13, 22, 31, 35, 44]) },
  { id: 'hicaz-tr', region: 'トルコ・マカーム', name: 'ヒジャーズ（AEU）', tuning: '53-TET', cents: fromCommas([0, 5, 17, 22, 31, 40, 44]) },
  { id: 'rast-tr', region: 'トルコ・マカーム', name: 'ラスト（AEU）', tuning: '53-TET', cents: fromCommas([0, 9, 17, 22, 31, 40, 48]) },

  // ── ペルシア・ダストガー ─────────────────────
  { id: 'shur', region: 'ペルシア・ダストガー', name: 'シュール', tuning: '24-TET近似', cents: [0, 150, 300, 500, 700, 800, 1000], note: 'コロン（約1/4音下げ）は演奏者により揺れる。' },
  { id: 'chahargah', region: 'ペルシア・ダストガー', name: 'チャハールガー', tuning: '24-TET近似', cents: [0, 150, 400, 500, 700, 850, 1100] },
  { id: 'homayoun', region: 'ペルシア・ダストガー', name: 'ホマーユーン', tuning: '24-TET近似', cents: [0, 150, 400, 500, 700, 800, 1000] },

  // ── インドネシア・ガムラン ───────────────────
  { id: 'slendro', region: 'インドネシア・ガムラン', name: 'スレンドロ', tuning: '実測近似', cents: [0, 231, 474, 717, 955],
    note: '約240cのほぼ等分5音。楽団ごとに異なる代表値。' },
  { id: 'pelog', region: 'インドネシア・ガムラン', name: 'ペロッグ（7音）', tuning: '実測近似', cents: [0, 120, 258, 538, 675, 785, 943] },
  { id: 'selisir', region: 'インドネシア・ガムラン', name: 'スリシール（バリ）', tuning: '実測近似', cents: [0, 120, 258, 675, 785],
    note: 'バリのゴング・クビャールでは対の楽器を数Hzずらし「オンバッ」と呼ぶうなりを作る。デチューンで再現できる。' },

  // ── 東アジア ─────────────────────────────
  { id: 'gong', region: '東アジア', name: '中国・宮調（ピタゴラス）', tuning: 'Pythagorean', cents: [0, r(9, 8), r(81, 64), r(3, 2), r(27, 16)], labels: ['宮', '商', '角', '徴', '羽'] },
  { id: 'shang', region: '東アジア', name: '中国・商調', tuning: 'Pythagorean', cents: [0, r(9, 8), r(4, 3), r(3, 2), r(16, 9)], labels: ['商', '角', '徴', '羽', '宮'] },
  { id: 'jue', region: '東アジア', name: '中国・角調', tuning: 'Pythagorean', cents: [0, r(32, 27), r(4, 3), r(128, 81), r(16, 9)], labels: ['角', '徴', '羽', '宮', '商'] },
  { id: 'zhi', region: '東アジア', name: '中国・徴調', tuning: 'Pythagorean', cents: [0, r(9, 8), r(4, 3), r(3, 2), r(27, 16)], labels: ['徴', '羽', '宮', '商', '角'] },
  { id: 'yu', region: '東アジア', name: '中国・羽調', tuning: 'Pythagorean', cents: [0, r(32, 27), r(4, 3), r(3, 2), r(16, 9)], labels: ['羽', '宮', '商', '角', '徴'] },
  { id: 'pyeongjo', region: '東アジア', name: '韓国・平調', tuning: '12-TET', cents: [0, 200, 500, 700, 900] },
  { id: 'gyemyeonjo', region: '東アジア', name: '韓国・界面調', tuning: '12-TET', cents: [0, 300, 500, 700, 1000] },

  // ── 東南アジア ───────────────────────────
  { id: 'thai7', region: '東南アジア', name: 'タイ7平均律', tuning: '7-EDO', cents: edo(7), note: 'ピーパート等の理論的な7等分。' },

  // ── アフリカ ────────────────────────────
  { id: 'tizita-maj', region: 'アフリカ', name: 'エチオピア・ティジータ（長）', tuning: '12-TET', cents: [0, 200, 400, 700, 900], note: '「郷愁」を意味するキニット。' },
  { id: 'tizita-min', region: 'アフリカ', name: 'エチオピア・ティジータ（短）', tuning: '12-TET', cents: [0, 200, 300, 700, 800] },
  { id: 'bati', region: 'アフリカ', name: 'エチオピア・バティ', tuning: '12-TET', cents: [0, 400, 500, 700, 1100] },
  { id: 'ambassel', region: 'アフリカ', name: 'エチオピア・アンバセル', tuning: '12-TET', cents: [0, 100, 500, 700, 800] },
  { id: 'anchihoye', region: 'アフリカ', name: 'エチオピア・アンチホイエ', tuning: '12-TET', cents: [0, 100, 500, 600, 900] },
  { id: 'mbira', region: 'アフリカ', name: 'ショナ・ムビラ（ニャマロパ近似）', tuning: '実測近似', cents: [0, 170, 350, 500, 700, 860, 1030], note: '奏者ごとに大きく異なる代表例。' },

  // ── ユーラシア・地中海 ──────────────────────
  { id: 'freygish', region: 'ユーラシア・地中海', name: 'フライギッシュ（クレズマー）', tuning: '12-TET', cents: [0, 100, 400, 500, 700, 800, 1000] },
  { id: 'hungarian', region: 'ユーラシア・地中海', name: 'ハンガリー短音階', tuning: '12-TET', cents: [0, 200, 300, 600, 700, 800, 1100] },
  { id: 'dorian-byz', region: 'ユーラシア・地中海', name: 'ビザンチン第1旋法（近似）', tuning: '72-EDO近似', cents: [0, 200, 283, 500, 700, 900, 983] },

  // ── 倍音・理論 ───────────────────────────
  { id: 'harmonic', region: '倍音・理論', name: '倍音列 8–16（ホーメイ / ディジュリドゥ）', tuning: 'harmonic',
    cents: [8, 9, 10, 11, 12, 13, 14, 15].map((n) => r(n, 8)), labels: ['8', '9', '10', '11', '12', '13', '14', '15'],
    note: '喉歌や倍音唱法が選び出す自然倍音。11・13倍音は平均律にない音程。' },
  { id: 'just-major', region: '倍音・理論', name: '純正長音階', tuning: 'just', cents: [0, r(9, 8), r(5, 4), r(4, 3), r(3, 2), r(5, 3), r(15, 8)] },
  { id: 'partch-otonal', region: '倍音・理論', name: 'パーチ 11-limit オトナリティ', tuning: 'just', cents: [r(8, 8), r(9, 8), r(10, 8), r(11, 8), r(12, 8), r(14, 8)], labels: ['1', '9/8', '5/4', '11/8', '3/2', '7/4'] },
  { id: 'edo12', region: '倍音・理論', name: '12平均律（半音階）', tuning: '12-TET', cents: edo(12) },
];

// 調律の基準周波数プリセット（文化的・慣習的な参照値。医学的根拠を示すものではない）
// 低域（20〜250Hz）用
export const ROOT_PRESETS = [
  { label: 'A0', hz: 27.5 },
  { label: 'C1', hz: 32.7 },
  { label: 'D1', hz: 36.71 },
  { label: 'E1', hz: 41.2 },
  { label: 'G1', hz: 49 },
  { label: 'A1', hz: 55 },
  { label: 'D2', hz: 73.42 },
  { label: 'A2', hz: 110 },
  { label: '432/8', hz: 54, title: 'A=432Hz系のA1（文化的な慣習値）' },
  { label: 'Om/2', hz: 68.05, title: 'Om 136.1Hz の1オクターブ下（文化的な慣習値）' },
];

// テキスト（セント値・比率混在）を解析。"0, 203.9, 5/4, 3/2"
export function parsePitchList(text) {
  const out = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const t = raw.trim();
    if (!t) continue;
    if (t.includes('/')) {
      const [a, b] = t.split('/').map(Number);
      if (a > 0 && b > 0) out.push(1200 * Math.log2(a / b));
    } else if (!Number.isNaN(Number(t))) {
      out.push(Number(t));
    }
  }
  return normalizeCents(out);
}

// Scala (.scl) 形式の解析。http://www.huygens-fokker.org/scala/scl_format.html
export function parseScl(text) {
  const lines = text.split(/\r?\n/).filter((l) => !l.trim().startsWith('!'));
  const description = (lines.shift() || '').trim();
  const count = parseInt((lines.shift() || '').trim(), 10);
  const pitches = [];
  for (const line of lines) {
    if (pitches.length >= count) break;
    const tok = line.trim().split(/\s+/)[0];
    if (!tok) continue;
    if (tok.includes('.')) pitches.push(parseFloat(tok));
    else if (tok.includes('/')) {
      const [a, b] = tok.split('/').map(Number);
      pitches.push(1200 * Math.log2(a / b));
    } else pitches.push(1200 * Math.log2(Number(tok)));
  }
  if (!Number.isFinite(count) || pitches.length !== count) throw new Error('.sclの音数と記載された音程の数が一致しません');
  const period = pitches.pop() ?? 1200; // 最終行は周期（通常オクターブ）
  return { description, cents: normalizeCents([0, ...pitches]), period };
}

export function normalizeCents(list) {
  const set = [...new Set(list.map((c) => +(((c % 1200) + 1200) % 1200).toFixed(2)))];
  return set.sort((a, b) => a - b);
}

export function getScale(id) {
  return SCALES.find((s) => s.id === id) || SCALES[0];
}

// 完全5度（702c）に最も近い度数を探す（タンプーラのPa・ドローンの初期和音用）
export function nearestFifthIndex(cents) {
  let best = -1, bestD = 60;
  cents.forEach((c, i) => { const d = Math.abs(c - 702); if (i > 0 && d < bestD) { best = i; bestD = d; } });
  return best;
}
