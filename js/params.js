// パラメータ定義（UIはこのスキーマから自動生成される）
// log: 対数スライダー / off: 0を「オフ」と表示
export const GROUPS = [
  { id: 'tuning', label: '調律', en: 'Tuning' },
  { id: 'timbre', label: '音色', en: 'Timbre' },
  { id: 'drift', label: '有機的揺らぎ', en: 'Organic drift' },
  { id: 'mode', label: '駆動モード', en: 'Excitation' },
  { id: 'therapy', label: '療法レイヤー', en: 'Therapy' },
  { id: 'breath', label: '共鳴呼吸ガイド', en: 'Resonance breathing' },
  { id: 'space', label: '空間', en: 'Space' },
  { id: 'session', label: 'セッション', en: 'Session' },
];

export const PARAMS = [
  // 調律
  { key: 'rootHz', group: 'tuning', label: '基音', min: 30, max: 600, step: 0.01, def: 110, unit: 'Hz', log: true },
  { key: 'fineCents', group: 'tuning', label: '微調整', min: -100, max: 100, step: 1, def: 0, unit: 'c' },
  { key: 'subLevel', group: 'tuning', label: 'サブオクターブ', min: 0, max: 1, step: 0.01, def: 0.5 },
  { key: 'upperLevel', group: 'tuning', label: '上オクターブ', min: 0, max: 1, step: 0.01, def: 0.25 },

  // 音色
  { key: 'harmonics', group: 'timbre', label: '倍音数', min: 1, max: 48, step: 1, def: 10 },
  { key: 'rolloff', group: 'timbre', label: '倍音の減衰', min: 0.4, max: 3, step: 0.01, def: 1.4 },
  { key: 'oddEven', group: 'timbre', label: '奇数 ↔ 偶数', min: -1, max: 1, step: 0.01, def: -0.2 },
  { key: 'unison', group: 'timbre', label: 'ユニゾン数', min: 1, max: 5, step: 1, def: 3, rebuild: true },
  { key: 'detune', group: 'timbre', label: 'デチューン', min: 0, max: 30, step: 0.1, def: 5, unit: 'c' },
  { key: 'cutoff', group: 'timbre', label: 'フィルター', min: 80, max: 14000, step: 1, def: 2600, unit: 'Hz', log: true },
  { key: 'resonance', group: 'timbre', label: 'レゾナンス', min: 0.1, max: 14, step: 0.01, def: 0.8 },

  // 有機的揺らぎ（Radigue的な非同期ドリフト）
  { key: 'driftCents', group: 'drift', label: 'ピッチの揺らぎ', min: 0, max: 40, step: 0.1, def: 6, unit: 'c' },
  { key: 'driftRate', group: 'drift', label: '揺らぎの速さ', min: 0.003, max: 0.6, step: 0.001, def: 0.04, unit: 'Hz', log: true },
  { key: 'ampDrift', group: 'drift', label: '音量の揺らぎ', min: 0, max: 1, step: 0.01, def: 0.35 },
  { key: 'spread', group: 'drift', label: 'ステレオ幅', min: 0, max: 1, step: 0.01, def: 0.7 },

  // 駆動モード
  { key: 'mode', group: 'mode', label: 'モード', type: 'select', def: 'sustain', rebuild: true,
    options: [['sustain', '持続（シュルティ箱）'], ['tanpura', 'タンプーラ（撥弦循環）'], ['hybrid', '両方']] },
  { key: 'tanpuraCycle', group: 'mode', label: '1周の長さ', min: 1.2, max: 10, step: 0.1, def: 3.6, unit: 's' },
  { key: 'pluckDecay', group: 'mode', label: '余韻', min: 1, max: 12, step: 0.1, def: 5, unit: 's' },
  { key: 'jawari', group: 'mode', label: 'ジャワリ（さわり）', min: 0, max: 1, step: 0.01, def: 0.55 },

  // 療法レイヤー
  { key: 'beatHz', group: 'therapy', label: '刺激周波数', min: 0.5, max: 60, step: 0.1, def: 40, unit: 'Hz', log: true },
  { key: 'amDepth', group: 'therapy', label: 'ドローンへのAM深さ', min: 0, max: 1, step: 0.01, def: 0, off: true },
  { key: 'amShape', group: 'therapy', label: 'AM波形', type: 'select', def: 'sine', options: [['sine', '正弦（やわらかい）'], ['pulse', 'パルス（クリック的）']] },
  { key: 'isoLevel', group: 'therapy', label: 'アイソクロニック音', min: 0, max: 1, step: 0.01, def: 0, off: true },
  { key: 'binauralLevel', group: 'therapy', label: 'バイノーラル', min: 0, max: 1, step: 0.01, def: 0, off: true },
  { key: 'carrierHz', group: 'therapy', label: 'キャリア周波数', min: 60, max: 1000, step: 0.1, def: 220, unit: 'Hz', log: true },
  { key: 'carrierLock', group: 'therapy', label: 'キャリアを基音に追従', type: 'select', def: 'on', options: [['on', '追従（倍音に溶かす）'], ['off', '固定']] },

  // 共鳴呼吸
  { key: 'breathBpm', group: 'breath', label: '呼吸数', min: 0, max: 12, step: 0.1, def: 0, unit: '回/分', off: true },
  { key: 'inhaleRatio', group: 'breath', label: '吸う割合', min: 0.2, max: 0.6, step: 0.01, def: 0.4 },
  { key: 'breathDepth', group: 'breath', label: '音量の膨らみ', min: 0, max: 1, step: 0.01, def: 0.45 },
  { key: 'breathFilter', group: 'breath', label: '音色の開き', min: 0, max: 1, step: 0.01, def: 0.5 },

  // 空間
  { key: 'reverbMix', group: 'space', label: 'リバーブ', min: 0, max: 1, step: 0.01, def: 0.35 },
  { key: 'reverbDecay', group: 'space', label: '残響時間', min: 1, max: 20, step: 0.1, def: 9, unit: 's' },
  { key: 'delayMix', group: 'space', label: 'ディレイ', min: 0, max: 0.8, step: 0.01, def: 0.12 },
  { key: 'delayTime', group: 'space', label: 'ディレイ時間', min: 0.05, max: 2, step: 0.01, def: 0.83, unit: 's' },
  { key: 'delayFb', group: 'space', label: 'フィードバック', min: 0, max: 0.9, step: 0.01, def: 0.45 },

  // セッション
  { key: 'volume', group: 'session', label: '音量', min: 0, max: 1, step: 0.01, def: 0.55 },
  { key: 'fadeIn', group: 'session', label: 'フェードイン', min: 0, max: 60, step: 1, def: 8, unit: 's' },
  { key: 'sessionMin', group: 'session', label: 'セッション長', min: 0, max: 120, step: 1, def: 0, unit: '分', off: true, offLabel: '無制限' },
  { key: 'fadeOut', group: 'session', label: 'フェードアウト', min: 2, max: 180, step: 1, def: 30, unit: 's' },
];

export const DEFAULTS = Object.fromEntries(PARAMS.map((p) => [p.key, p.def]));
DEFAULTS.scaleId = 'ryukyu-just';
DEFAULTS.degrees = [0, 3];
DEFAULTS.customCents = '';

export const PARAM_BY_KEY = Object.fromEntries(PARAMS.map((p) => [p.key, p]));

// シーン（療法目的のプリセット）。指定されていない値はデフォルトに戻す。
export const SCENES = [
  { id: 'gamma40', name: '40Hz ガンマ', desc: '琉球純正のドローンに40Hzの振幅変調とクリック音を重ねる',
    params: { scaleId: 'ryukyu-just', degrees: [0, 3], rootHz: 110, amDepth: 0.55, amShape: 'pulse', isoLevel: 0.12, beatHz: 40, carrierHz: 440 } },
  { id: 'resonance6', name: '6回/分 共鳴呼吸', desc: '0.1Hzの音の満ち引きで、吸う4秒・吐く6秒へ導く',
    params: { scaleId: 'yaman', degrees: [0, 4], rootHz: 130.81, breathBpm: 6, inhaleRatio: 0.4, breathDepth: 0.55, breathFilter: 0.6, reverbMix: 0.45 } },
  { id: 'theta-rest', name: 'シータ休息', desc: '6Hzのバイノーラルビート。ヘッドホン必須',
    params: { scaleId: 'slendro', degrees: [0, 3], rootHz: 73.42, binauralLevel: 0.3, beatHz: 6, carrierLock: 'off', carrierHz: 200, driftCents: 10, reverbMix: 0.5 } },
  { id: 'delta-sleep', name: 'デルタ入眠', desc: '2Hzのゆるいうねりと長いフェードアウト付き30分',
    params: { scaleId: 'harmonic', degrees: [0, 4], rootHz: 55, amDepth: 0.25, beatHz: 2, cutoff: 900, sessionMin: 30, fadeOut: 120, breathBpm: 5, breathDepth: 0.35 } },
  { id: 'tanpura-yaman', name: 'タンプーラ・ヤマン', desc: 'Pa–Sa–Sa–Saの撥弦循環。ラーガ練習の伴奏に',
    params: { scaleId: 'yaman', degrees: [0, 4], rootHz: 138.59, mode: 'tanpura', subLevel: 0.6, upperLevel: 0, jawari: 0.65, reverbMix: 0.3 } },
  { id: 'maqam-rast', name: 'マカーム・ラースト', desc: '中立3度を含む和音をゆっくり揺らす',
    params: { scaleId: 'rast', degrees: [0, 2, 4], rootHz: 98, driftCents: 9, unison: 2, detune: 3, reverbMix: 0.4 } },
  { id: 'ombak', name: 'ガムランのうなり', desc: 'スリシールの対楽器的デチューンで揺れる金属音',
    params: { scaleId: 'selisir', degrees: [0, 2, 3], rootHz: 220, harmonics: 24, rolloff: 0.9, oddEven: 0.5, detune: 18, unison: 2, reverbMix: 0.5 } },
  { id: 'okinawa-dusk', name: '今帰仁の夕凪', desc: '琉球音階を三味線の高さで、波のような呼吸ガイド付き',
    params: { scaleId: 'ryukyu', degrees: [0, 1, 3], rootHz: 146.83, breathBpm: 5.5, breathDepth: 0.4, amDepth: 0.15, beatHz: 40, reverbMix: 0.5, reverbDecay: 14 } },
];
