// HYPOGEUM // KKR-40 — コードブック（コード名 ↔ 平文の対応表）
// UIに出るコード名はすべてここから引く。docs/CODEBOOK.md は scripts/codebook.mjs で自動生成。
// 安全注意だけは暗号化しない（index.html に平文で直書き）。

export const PRODUCT = { code: 'HYPOGEUM // KKR-40', plain: '地下の石室・低域ドローン楽器（旧 KUKURU）' };

// ── グループ ──────────────────────────────
export const GROUP_CODES = {
  tuning: { code: '§0x1 TUN', plain: '調律' },
  mode: { code: '§0x2 EXC', plain: '駆動モード' },
  gen: { code: '§0x3 GEN', plain: '音色エンジン' },
  drift: { code: '§0x4 DRF', plain: '有機的揺らぎ' },
  therapy: { code: '§0x5 Γ40', plain: '療法レイヤー（40Hz・アイソクロニック・バイノーラル）' },
  breath: { code: '§0x6 Φ.RSP', plain: '共鳴呼吸ガイド' },
  space: { code: '§0x7 SPC', plain: '空間・低域マスター処理' },
  session: { code: '§0x8 SES', plain: 'セッション' },
};

// ── パラメータ（キーは内部名。v2で短いASCII名に改めた）──
export const PARAM_CODES = {
  f0: { code: 'F₀', plain: '基音' },
  dc: { code: 'Δ¢', plain: '微調整' },
  subK: { code: 'SUB.k', plain: 'サブオクターブ量' },
  hiK: { code: 'SUP.k', plain: '上オクターブ量' },

  exc: { code: 'EXC.m', plain: '駆動モード' },
  cyc: { code: 'T.cyc', plain: 'タンプーラ1周の長さ' },
  tau: { code: 'τ.dk', plain: '撥弦の余韻' },
  jaw: { code: 'JWR', plain: 'ジャワリ（さわり）' },

  eng: { code: 'ENG', plain: '音色エンジン' },
  ma: { code: 'Α', plain: 'マクロΑ（意味はエンジンごと）' },
  mb: { code: 'Β', plain: 'マクロΒ（意味はエンジンごと）' },
  mc: { code: 'Γ', plain: 'マクロΓ（意味はエンジンごと）' },
  hN: { code: 'H.n', plain: '倍音数（ADD.H・撥弦）' },
  rho: { code: 'ρ', plain: '倍音の減衰（ADD.H・撥弦）' },
  oe: { code: 'O/E', plain: '奇数 ↔ 偶数倍音（ADD.H・撥弦）' },
  uni: { code: 'U.n', plain: 'ユニゾン数（ADD.H）' },
  dt: { code: 'δ', plain: 'デチューン（ADD.H）' },
  lpw: { code: 'LP.ω', plain: 'フィルター（全体ローパス）' },
  lpq: { code: 'LP.Q', plain: 'レゾナンス' },

  dfc: { code: 'ΔF.¢', plain: 'ピッチの揺らぎ' },
  dfr: { code: 'ΔF.hz', plain: '揺らぎの速さ' },
  dfa: { code: 'ΔA', plain: '音量の揺らぎ' },
  wid: { code: 'W.st', plain: 'ステレオ幅（MONO.xより上の帯域）' },

  ghz: { code: 'Γ.hz', plain: '刺激周波数' },
  amd: { code: 'AM.d', plain: 'ドローンへのAM深さ' },
  ams: { code: 'AM.w', plain: 'AM波形' },
  iso: { code: 'ISO.k', plain: 'アイソクロニック音' },
  bin: { code: 'BIN.k', plain: 'バイノーラル' },
  car: { code: 'C.hz', plain: 'キャリア周波数（下限120Hz）' },
  carL: { code: 'C.lk', plain: 'キャリアを基音に追従' },

  pbpm: { code: 'Φ.bpm', plain: '呼吸数' },
  pin: { code: 'Φ.in', plain: '吸う割合' },
  pamp: { code: 'Φ.A', plain: '音量の膨らみ' },
  pflt: { code: 'Φ.ω', plain: '音色の開き' },

  rvb: { code: 'RV.k', plain: 'リバーブ' },
  rvt: { code: 'RV.t', plain: '残響時間' },
  dly: { code: 'DL.k', plain: 'ディレイ' },
  dlt: { code: 'DL.t', plain: 'ディレイ時間' },
  dlf: { code: 'DL.fb', plain: 'ディレイのフィードバック' },
  hpf: { code: 'HPF.ω', plain: 'サブソニック・ハイパス（24dB/oct）' },
  monoX: { code: 'MONO.x', plain: 'モノ化クロスオーバー（これより下はモノ）' },
  psy: { code: 'PSY.h', plain: '倍音エンハンサー（ミッシング・ファンダメンタル）' },
  drv: { code: 'DRV', plain: 'ソフトクリップ（共通マスター段、リミッター前）' },

  vol: { code: 'VOL', plain: '音量' },
  fin: { code: 'F.in', plain: 'フェードイン' },
  ses: { code: 'S.min', plain: 'セッション長' },
  fout: { code: 'F.out', plain: 'フェードアウト' },
};

// 状態（スライダー以外）のコード
export const STATE_CODES = {
  scl: { code: 'SCL', plain: '音階' },
  deg: { code: 'DEG', plain: '鳴らす度数' },
  cst: { code: 'CST', plain: 'カスタム音階（セント・比率・.scl）' },
};

// セレクトの選択肢
export const OPTION_CODES = {
  exc: { sustain: { code: 'SUS', plain: '持続（シュルティ箱）' }, tanpura: { code: 'TNP', plain: 'タンプーラ（撥弦循環）' }, hybrid: { code: 'HYB', plain: '両方' } },
  ams: { sine: { code: 'SIN', plain: '正弦（やわらかい）' }, pulse: { code: 'PLS', plain: 'パルス（クリック的）' } },
  carL: { on: { code: 'LCK', plain: '追従（倍音に溶かす）' }, off: { code: 'FIX', plain: '固定' } },
};

// ── 音色エンジン ─────────────────────────────
// macros: [Α, Β, Γ] それぞれ [短いコード, 平文]
export const ENGINE_CODES = {
  add: { code: 'ADD.H', plain: '加算合成（PeriodicWave倍音列）', macros: [['H.n×', '倍音数（H.n からの増減）'], ['ρ±', '減衰（ρ からの増減）'], ['O/E±', '奇偶（O/E からの増減）']] },
  sin: { code: 'SIN.0', plain: '純正弦＋2倍音・tanh飽和', macros: [['H2', '2倍音量'], ['SAT', '飽和'], ['H3', '3倍音量']] },
  reese: { code: 'R33S', plain: 'リース・ベース（デチューンしたノコギリ波2〜4本）', macros: [['DTN', 'デチューン幅'], ['N.os', '本数（2〜4）'], ['LP', 'ローパスの開き']] },
  fm2: { code: 'FM.2', plain: '2オペレーターFM', macros: [['IDX', '変調指数'], ['RAT', '周波数比（0.5/1/2/3）'], ['FB~', 'フィードバック風の歪み']] },
  fold: { code: 'F0LD', plain: 'ウェーブフォールダー（Buchla系）', macros: [['FLD', '折り返し量'], ['SYM', '対称性'], ['LP', '後段ローパス']] },
  undr: { code: 'UNDR', plain: 'アンダートーン分周（f/2・f/3・f/4の矩形）', macros: [['÷2', 'f/2の量'], ['÷3', 'f/3の量'], ['÷4', 'f/4の量']] },
  ladder: { code: 'L4DR', plain: 'ラダー・ローパス近似（biquad4段＋tanh）', macros: [['FC', 'カットオフ'], ['RES', 'レゾナンス'], ['DRV', 'ドライブ']] },
  pwm: { code: 'PWM', plain: 'パルス幅変調（ノコギリ2本の位相差）', macros: [['PW', 'パルス幅'], ['RT', 'PWMの速さ'], ['DP', 'PWMの深さ']] },
  organ: { code: 'ORG.16', plain: 'ドローバー・オルガン 16′ 8′ 5⅓′ 4′（16′＝基音）', macros: [['16′', '16′（基音）'], ['5⅓′', '5⅓′（3倍音）'], ['4′', '4′（4倍音）']] },
  kargyraa: { code: 'KRG', plain: 'カルグラ（喉歌の低い唸り）', macros: [['VWL', '母音 o→u→a'], ['÷2', '分周（周期倍化）の量'], ['GRT', 'ざらつき']] },
  didj: { code: 'D1DJ', plain: 'ディジュリドゥ', macros: [['SWP', '掃引幅'], ['SPD', '掃引の速さ'], ['LIP', '唇の詰まり']] },
  bow: { code: 'B0W', plain: '擦弦ベース（ノイズ励起＋フィードバック・コム）', macros: [['PRS', '弓圧（ノイズ量）'], ['BDY', '胴鳴り'], ['DMP', '減衰']] },
  tape: { code: 'TAPE', plain: '低域ノイズ＋共鳴コム＋ワウ・フラッター', macros: [['RES', '共鳴'], ['FLT', 'フラッター'], ['BND', '帯域']] },
};

// ── 音階：地域コード＋略称＋音数＋調律記号 ─────────────
export const REGION_CODES = {
  '日本・琉球': 'JPN', 'インド・ラーガ': 'RAG', 'アラブ・マカーム': 'MQM', 'トルコ・マカーム': 'MKM',
  'ペルシア・ダストガー': 'DST', 'インドネシア・ガムラン': 'GML', '東アジア': 'EAS', '東南アジア': 'SEA',
  'アフリカ': 'AFR', 'ユーラシア・地中海': 'EUR', '倍音・理論': 'HRM',
};

export const TUNING_CODES = {
  E12: '12平均律', J: '純正律', S: '22シュルティの純正比', Q: '24平均律', 'Q~': '24平均律近似',
  C53: '53コンマ（トルコ）', M: '実測近似', P: 'ピタゴラス', E7: '7平均律', E72: '72平均律近似', H: '倍音列', X: '自作',
};

// id → [接頭辞, 調律記号]。音数は音階データから数える（code = 接頭辞-音数/記号）
export const SCALE_CODE_PARTS = {
  ryukyu: ['RYK', 'E12'], 'ryukyu-just': ['RYK', 'J'], minyo: ['JPN.MNY', 'E12'], miyakobushi: ['JPN.MYK', 'E12'],
  yo: ['JPN.YO', 'E12'], hirajoshi: ['JPN.HRJ', 'E12'], kumoi: ['JPN.KMI', 'E12'], iwato: ['JPN.IWT', 'E12'],
  yaman: ['RAG.YMN', 'S'], bhairav: ['RAG.BHV', 'S'], bhairavi: ['RAG.BVI', 'S'], todi: ['RAG.TOD', 'S'],
  marwa: ['RAG.MRW', 'S'], bhupali: ['RAG.BHP', 'S'], malkauns: ['RAG.MLK', 'S'], kafi: ['RAG.KFI', 'S'],
  rast: ['MQM.RST', 'Q'], bayati: ['MQM.BYT', 'Q'], hijaz: ['MQM.HJZ', 'Q'], saba: ['MQM.SBA', 'Q'],
  sikah: ['MQM.SKH', 'Q'], kurd: ['MQM.KRD', 'Q'], nahawand: ['MQM.NHW', 'Q'],
  ussak: ['MKM.USK', 'C53'], 'hicaz-tr': ['MKM.HCZ', 'C53'], 'rast-tr': ['MKM.RST', 'C53'],
  shur: ['DST.SHR', 'Q~'], chahargah: ['DST.CHG', 'Q~'], homayoun: ['DST.HMY', 'Q~'],
  slendro: ['GML.SLN', 'M'], pelog: ['GML.PLG', 'M'], selisir: ['GML.SLS', 'M'],
  gong: ['EAS.GNG', 'P'], shang: ['EAS.SHG', 'P'], jue: ['EAS.JUE', 'P'], zhi: ['EAS.ZHI', 'P'], yu: ['EAS.YU', 'P'],
  pyeongjo: ['EAS.PYJ', 'E12'], gyemyeonjo: ['EAS.GMJ', 'E12'],
  thai7: ['SEA.TH7', 'E7'],
  'tizita-maj': ['AFR.TZM', 'E12'], 'tizita-min': ['AFR.TZN', 'E12'], bati: ['AFR.BTI', 'E12'],
  ambassel: ['AFR.AMB', 'E12'], anchihoye: ['AFR.ACH', 'E12'], mbira: ['AFR.MBR', 'M'],
  freygish: ['EUR.FRG', 'E12'], hungarian: ['EUR.HNG', 'E12'], 'dorian-byz': ['EUR.BYZ', 'E72'],
  harmonic: ['HRM.H8', 'H'], 'just-major': ['HRM.JMJ', 'J'], 'partch-otonal': ['HRM.P11', 'J'], edo12: ['HRM.E12', 'E12'],
};

export function scaleCode(id, count) {
  if (id === 'custom') return `USR-${count}/X`;
  const [pre, sym] = SCALE_CODE_PARTS[id] || ['UNK', 'X'];
  return `${pre}-${count}/${sym}`;
}

// ── シーン（プログラム番号）─────────────────────
export const SCENE_CODES = {
  gamma40: { code: 'PRG-40G', plain: '40Hz ガンマ' },
  resonance6: { code: 'PRG-0.1R', plain: '6回/分 共鳴呼吸' },
  'theta-rest': { code: 'PRG-θ6', plain: 'シータ休息（6Hzバイノーラル）' },
  'delta-sleep': { code: 'PRG-δ2', plain: 'デルタ入眠' },
  'tanpura-yaman': { code: 'PRG-TNP', plain: 'タンプーラ・ヤマン' },
  'maqam-rast': { code: 'PRG-MQR', plain: 'マカーム・ラースト' },
  ombak: { code: 'PRG-OMB', plain: 'ガムランのうなり（オンバッ）' },
  'okinawa-dusk': { code: 'PRG-NKJ', plain: '今帰仁の夕凪' },
  b01: { code: 'PRG-B01', plain: '純正弦の床（SIN.0）' },
  b02: { code: 'PRG-B02', plain: 'リースの地鳴り（R33S）' },
  b03: { code: 'PRG-B03', plain: 'FMの鉄骨（FM.2）' },
  b04: { code: 'PRG-B04', plain: '折り返す岩盤（F0LD）' },
  b05: { code: 'PRG-B05', plain: '分周の階段（UNDR）' },
  b06: { code: 'PRG-B06', plain: 'ラダーの唸り（L4DR）' },
  b07: { code: 'PRG-B07', plain: '呼吸するパルス（PWM）' },
  b08: { code: 'PRG-B08', plain: '石室のペダル（ORG.16）' },
  b09: { code: 'PRG-B09', plain: 'カルグラ（KRG）' },
  b10: { code: 'PRG-B10', plain: 'ディジュリドゥ（D1DJ）' },
  b11: { code: 'PRG-B11', plain: '擦弦コントラバス（B0W）' },
  b12: { code: 'PRG-B12', plain: '磁気テープの井戸（TAPE）' },
};

// ── v1（KUKURU）→ v2 のキー対応 ─────────────────
export const LEGACY_KEYS = {
  rootHz: 'f0', fineCents: 'dc', subLevel: 'subK', upperLevel: 'hiK',
  harmonics: 'hN', rolloff: 'rho', oddEven: 'oe', unison: 'uni', detune: 'dt', cutoff: 'lpw', resonance: 'lpq',
  driftCents: 'dfc', driftRate: 'dfr', ampDrift: 'dfa', spread: 'wid',
  mode: 'exc', tanpuraCycle: 'cyc', pluckDecay: 'tau', jawari: 'jaw',
  beatHz: 'ghz', amDepth: 'amd', amShape: 'ams', isoLevel: 'iso', binauralLevel: 'bin', carrierHz: 'car', carrierLock: 'carL',
  breathBpm: 'pbpm', inhaleRatio: 'pin', breathDepth: 'pamp', breathFilter: 'pflt',
  reverbMix: 'rvb', reverbDecay: 'rvt', delayMix: 'dly', delayTime: 'dlt', delayFb: 'dlf',
  volume: 'vol', fadeIn: 'fin', sessionMin: 'ses', fadeOut: 'fout',
  scaleId: 'scl', degrees: 'deg', customCents: 'cst',
};

export const LEGACY_STORE_KEY = 'kukuru-drone:v1';
export const STORE_KEY = 'hypogeum:v2';

// レジスタ番号（UIの刻印用）: R0x10 から順に
export const registerOf = (index) => `R0x${(0x10 + index).toString(16).toUpperCase()}`;
