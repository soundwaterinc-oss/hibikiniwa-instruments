// STOMA//16 — コードブック（コード名 ↔ 平文）。UIの表示・docs/CODEBOOK.md はここから作る
// 安全注意だけは暗号化しない（index.html に平文で直書き）

export const PRODUCT = { code: 'STOMA//16', plain: '植物細胞の形からリズムを作る楽器（細胞幾何リズム装置）' };
export const STORE_KEY = 'stoma16:v2';

export const GROUP_CODES = {
  seg: { code: '§0x1 SEG', plain: '細胞の切り分け' },
  map: { code: '§0x2 MAP', plain: '形 → 時間の写像' },
  clk: { code: '§0x3 CLK', plain: 'テンポと揺れ' },
  evo: { code: '§0x4 EVO', plain: '自動展開' },
  fx: { code: '§0x5 FX', plain: '質感・空間' },
};

export const PARAM_CODES = {
  ch: { code: 'CH', plain: '見る特徴' },
  inv: { code: 'INV', plain: '壁が明るい画像' },
  res: { code: 'RES', plain: '解析解像度（長辺の画素数）' },
  sig: { code: 'Σ.σ', plain: '線を見る太さ（ヘッセ行列のスケール倍率）' },
  hi: { code: 'THR.H', plain: '壁の閾値（強）：ここを超える線から壁をたどる' },
  lo: { code: 'THR.L', plain: '壁の閾値（弱）：強い線につながっていれば壁とみなす' },
  gap: { code: 'GAP', plain: '途切れの補修（端点を伸ばす距離）' },
  mina: { code: 'MIN.A', plain: '最小面積（これより小さい区画は隣に吸収）' },
  fill: { code: 'FILL', plain: '内容物の埋め戻し（核・葉緑体の輪を消す大きさ）' },
  merge: { code: 'MRG', plain: '弱い境界の併合' },
  lin: { code: 'LIN', plain: '線の連続性（まっすぐ続く壁だけを残す長さ）' },
  edge: { code: 'EDGE', plain: '縁の切れた細胞' },

  mode: { code: 'MODE', plain: '走査方式' },
  bars: { code: 'BARS', plain: 'ループ小節数' },
  q: { code: 'Q', plain: '量子化の強さ' },
  dens: { code: 'DENS', plain: '打点の密度' },
  anchor: { code: 'ANC', plain: 'アンカー（拍の頭に必ず置くトラック）' },
  poly: { code: 'POLY', plain: 'ポリメトリック（トラックごとのループ長）' },
  clsw: { code: 'TIS.k', plain: '組織クラスを振り分けに効かせる強さ' },
  ang: { code: 'ANG', plain: '細胞の向きの写像先' },

  bpm: { code: 'BPM', plain: 'テンポ' },
  f0: { code: 'F₀', plain: '基音（SUB・低音・サブドローンの高さ。GARDEN BUS で共有）' },
  swg: { code: 'SWG', plain: 'MPC スウィング（50%＝なし）' },
  hum: { code: 'HUM', plain: '人の手の揺れ（スタイルの揺れの倍率）' },
  vol: { code: 'VOL', plain: '全体音量' },

  evo: { code: 'EVO', plain: '自動展開' },
  form: { code: 'FORM', plain: '構成の型' },
  phr: { code: 'PHR', plain: '1区間のループ数' },
  rate: { code: 'MUT', plain: '変化の量' },
  seed: { code: 'SEED', plain: '展開の種（0＝毎回ちがう）' },
  cyc: { code: 'CYC', plain: 'STYLE CYCLE（区間ごとにスタイルを段階的に移す）' },

  dly: { code: 'DLY', plain: 'ダブディレイ量' },
  dfb: { code: 'D.FB', plain: 'ディレイ帰還' },
  spr: { code: 'SPR', plain: 'スプリング残響' },
  sc: { code: 'S.CH', plain: 'サイドチェイン（キックで他を沈める）' },
  wow: { code: 'WOW', plain: 'テープのワウ' },
  crsh: { code: 'CRSH', plain: 'ビット深度（0=オフ）' },
  lofi: { code: 'LP.HZ', plain: 'ローファイLP' },
  crkl: { code: 'CRKL', plain: 'チリの頻度' },
  hiss: { code: 'HISS', plain: 'ヒス量' },
};

export const OPTION_CODES = {
  ch: { 0: ['LUMA', '明るさ（暗い壁）'], 1: ['CHL', '葉緑体・染色の密度の谷'], 2: ['WALL', '透明な細胞壁'], 3: ['RIDGE', '線状の壁（Frangi）'] },
  inv: { 0: ['OFF', '暗い壁'], 1: ['ON', '明るい壁'] },
  res: { 256: ['256', '粗い・速い'], 384: ['384', '標準'], 512: ['512', '細かい・遅い'] },
  edge: { 1: ['EXCL', '除外'], 0: ['INCL', '含める'] },
  mode: { SWEEP: ['SWEEP', '中心から回転走査（環ごとに小節）'], RASTER: ['RASTER', '左→右の読み取り'], WALK: ['WALK', '隣の細胞を辿る'] },
  bars: { 1: ['1', '1小節'], 2: ['2', '2小節'], 4: ['4', '4小節'] },
  anchor: { 1: ['ON', 'スタイルのアンカーを置く'], 0: ['OFF', '細胞だけで決める'] },
  poly: { OFF: ['OFF', '全トラック同じ長さ'], MAN: ['MAN', 'トラックごとに選ぶ（16/12/10/7）'], AUTO: ['AUTO', '細胞の周長から導く'] },
  ang: { OFF: ['OFF', '使わない'], PAN: ['PAN', '向き → 定位'], TONE: ['TONE', '向き → 音色（マクロ2）'], BOTH: ['BOTH', '定位と音色の両方'] },
  evo: { 0: ['OFF', '固定ループ'], 1: ['ON', '展開する'] },
  form: {
    ARC: ['ARC', '導入→盛り上がり→頂点→ブレイク→頂点→終息'], DUB: ['DUB', '落とす⇄残響だけ'], MIN: ['MIN', '1トラックずつ出入り'],
    DRF: ['DRF', '細胞を漂流し続ける'], TISSUE: ['TISSUE', '組織を外側から内側へ（皮層→内皮→中心柱）'],
  },
  phr: { 1: ['1', '1ループ'], 2: ['2', '2ループ'], 4: ['4', '4ループ'], 8: ['8', '8ループ'] },
  cyc: { 0: ['OFF', 'スタイル固定'], 1: ['ON', '区間ごとに次のスタイルへ移す'] },
};

// ── スタイル（参照作家の手法を合成音で再現するスタディ。サンプルは使わない）──
export const STYLE_CODES = {
  TWL: { code: 'REF.TWL', name: 'Azu Tiwaline', plain: 'ダブ×サハラの枠太鼓。3:4 のヘミオラが回転し、スプリング残響とサブドローン' },
  IKD: { code: 'REF.IKD', name: 'Ryoji Ikeda', plain: '純正弦のバーストとノイズとインパルス。64分割の完全量子化、細胞データを数値行列とバーコードで表示' },
  BDM: { code: 'REF.BDM', name: 'Budamunk', plain: 'MPC スウィング、16段階のベロシティ、合成ループのチョップ、キックでのサイドチェイン' },
  JLN: { code: 'REF.JLN', name: 'Jan Jelinek', plain: 'クリック＆カット。粒の長さ＝細胞の周長のグラニュラー、テープのワウ、64分のクリック層' },
};

// トラック（6本）。コードはスタイルごとに変わる（K.DUB など）。役割は共通
export const TRACK_CODES = [
  { code: 'K', plain: 'キック系', role: '大きく丸い細胞' },
  { code: 'T', plain: '低音・トーン系', role: '大きく細長い細胞' },
  { code: 'S', plain: 'スネア・響き系', role: '六角形的な中くらいの細胞' },
  { code: 'H', plain: 'ハット・ティック系', role: '小さい細胞（孔辺細胞など）' },
  { code: 'C', plain: 'クリック・打撃系', role: '極端に細長い細胞' },
  { code: 'Z', plain: 'ノイズ・質感系', role: '明暗の外れた細胞（内容物）' },
];
export const STYLE_TRACKS = {
  TWL: [['K.DUB', 'ダブキック'], ['T.DUM', 'ベンディール低音'], ['S.TEK', 'ベンディール響き線'], ['H.RIQ', 'リク・シェイカー'], ['C.STK', 'スティック'], ['Z.THR', 'ダブ投げノイズ']],
  IKD: [['K.SUB', '50Hz正弦パルス'], ['T.SIN', '純正弦バースト'], ['S.WHT', 'ホワイトノイズ・ゲート'], ['H.HF', '高域正弦ティック'], ['C.IMP', '単一サンプル・インパルス'], ['Z.BIT', '1ビット・ノイズ']],
  BDM: [['K.DST', 'ダスティ・キック'], ['T.CHP', '合成ループのチョップ'], ['S.SNR', 'スネア＋クラップ'], ['H.CHH', 'クローズドハット'], ['C.RIM', 'リムショット'], ['Z.VNL', 'シェイカー']],
  JLN: [['K.SFT', 'ソフトキック'], ['T.GRN', '和音のグラニュラー（粒の長さ＝周長）'], ['S.FLT', 'フィルター・ノイズ'], ['H.MCK', '64分のマイクロクリック'], ['C.CRK', 'チリ'], ['Z.HST', 'ヒスのスタッター']],
};

// ── 16音色（スタイルに関係なく各トラックに差し替えられる）。マクロ2つ（M1・M2）の意味は音色ごと ──
export const MODEL_CODES = {
  NAT: { plain: 'スタイル標準の音', macros: [['TON', '音色の明るさ'], ['LEN', '長さ']] },
  K808: { plain: '808キック：長い正弦と歪み', macros: [['DST', '歪み'], ['PCH', 'ピッチの落ち幅']] },
  FMK: { plain: 'FMキック：金属的なアタック', macros: [['IDX', '変調の強さ'], ['CLK', 'アタックの硬さ']] },
  MBR: { plain: '膜鳴：枠太鼓・タブラの倍音比', macros: [['STR', '打面の張り（音程）'], ['RNG', '胴鳴りの長さ']] },
  WOD: { plain: '木質打音：木魚・木琴', macros: [['HRD', '硬さ（高い倍音）'], ['PCH', '音程']] },
  GLS: { plain: 'ガラス・ベル：非整数倍音の長い余韻', macros: [['INH', '倍音のずれ'], ['TAIL', '余韻']] },
  KLM: { plain: 'カリンバ：五音音階の金属舌', macros: [['BUZ', 'さわりのうなり'], ['OCT', 'オクターブ']] },
  MTL: { plain: '金属：808シンバル式の6矩形波', macros: [['OPN', '開き（減衰）'], ['TON', '帯域']] },
  SNP: { plain: 'クラップ：3連の破裂と尾', macros: [['SPR', '破裂の間隔'], ['TAIL', '尾の長さ']] },
  SUB: { plain: 'サブベース：上から滑り込む低音', macros: [['GLD', '滑り込みの深さ'], ['DRV', '歪み']] },
  GRN: { plain: '和音グレイン：和音の一片', macros: [['LEN', '粒の長さ'], ['PIT', '再生速度']] },
  VOX: { plain: '息・母音：細長さで母音が変わる', macros: [['VWL', '母音'], ['BRT', '息の量']] },
  DRP: { plain: '水滴：上昇する正弦', macros: [['RIS', '上昇の幅'], ['LEN', '長さ']] },
  LEF: { plain: '葉擦れ：微細なノイズの粒', macros: [['DEN', '粒の密度'], ['BND', '帯域']] },
  IMP: { plain: 'インパルス：1サンプルのクリック', macros: [['FLT', 'フィルター'], ['RNG', '共鳴']] },
  BIT: { plain: '1ビット・ノイズ', macros: [['LEN', '長さ'], ['RAT', 'ビットの粗さ']] },
};

// ── EVO の区間 ──
export const SECTION_CODES = {
  INT: { code: '§INT', plain: '導入' }, BLD: { code: '§BLD', plain: '盛り上がり（BUILD）' }, PK: { code: '§PK', plain: '頂点' },
  BRK: { code: '§BRK', plain: 'ブレイク（ダブディレイの帰還を自動で上げ下げ）' }, DRP: { code: '§DRP', plain: 'ドロップ' }, ECH: { code: '§ECH', plain: '残響だけ' },
  OUT: { code: '§OUT', plain: '終息' }, DRF: { code: '§DRF', plain: '漂流' }, ADD: { code: '§ADD', plain: '加算（1トラックずつ出入り）' },
  RNG: { code: '§RNG', plain: '環（TISSUE：外側から n 番目の層）' },
};

// ── 組織クラスのコード規則：TIS.<色>-<大きさ> ──
export const TISSUE_COLOR_CODES = { R: '赤', Y: '黄', G: '緑', C: '青緑', B: '青', V: '紫', W: '白', K: '黒', N: '灰' };
export const TISSUE_SIZE_CODES = { sm: '小さい', md: '中くらい', lg: '大きい' };

export const SPECIMEN_CODES = {
  cork: { code: 'QRC.SUBR', plain: 'コルク（Hooke 1665の蜂の巣状組織）' },
  onion: { code: 'ALL.CEPA', plain: 'タマネギ表皮（細長い煉瓦積み・核あり）' },
  moss: { code: 'BRY.FOL', plain: '蘚類の葉（菱形細胞・葉緑体・中肋）' },
  stoma: { code: 'EPD.STM', plain: '葉の表皮（ジグソー状の細胞と気孔）' },
  'local-root': { code: 'LOC.ROOT', plain: 'LOCAL：根の横断面（fixtures/root_xs.jpg）' },
  'local-moss': { code: 'LOC.MOSS', plain: 'LOCAL：苔の葉（fixtures/moss_leaf.jpg）' },
  user: { code: 'USR.IMG', plain: '読み込んだ画像' },
  live: { code: 'LIV.CAM', plain: 'カメラ・USB顕微鏡のライブ入力' },
};

// 統計の表示コード
export const STAT_CODES = {
  N: { code: 'N.CELL', plain: '細胞数（縁に触れない細胞）' },
  meanN: { code: '⟨n⟩', plain: '平均隣接数（平面分割の理論値≈6）' },
  hex: { code: 'HEX', plain: '六角形（隣接6）の割合' },
  lewis: { code: 'LEWIS r', plain: 'ルイスの法則：面積と隣接数の相関' },
  aboav: { code: 'A–W a', plain: 'アボフ–ウィアの法則の係数 a（n·m(n) = (6−a)n + 6a + μ₂）' },
  meanA: { code: '⟨A⟩', plain: '平均面積（基準座標 px²）' },
  convex: { code: '⟨CVX⟩', plain: '平均の凸包率（ジグソー状ほど小さい）' },
  evidence: { code: 'EVD', plain: 'evidence：境界上の壁らしさ ÷ 全体平均' },
  tissue: { code: 'TIS', plain: '組織クラスの構成比' },
  evt: { code: 'EVT', plain: '1ループの打点数' },
};
