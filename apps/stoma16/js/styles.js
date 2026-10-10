// スタイルの音楽的な定義（各作家の手法を合成音で再現するスタディ。サンプルは使わない）
//   div   : トラックごとの1小節の分割数（16＝16分、12＝3連の8分、32/64＝細かい格子）
//   lay   : 発音の前後ずれ(ms)    jit : ランダムな揺れ(ms)
//   anchor: 拍の頭に必ず置くトラックと位置（小節内のステップ。div 基準）
//   trim  : トラックごとの音量の補正（スタイル標準の音色のとき）
import { STYLE_CODES, STYLE_TRACKS } from './codebook.js';

export const STYLES = {
  TWL: {
    ...STYLE_CODES.TWL, voices: STYLE_TRACKS.TWL,
    bpm: 118, swg: 0.5, q: 0.85, div: [16, 12, 16, 12, 16, 12], lay: [0, 0, 0, -4, 0, 0], jit: [2, 4, 3, 5, 2, 6], trim: [1, 1.5, 3.5, 3.2, 3, 4],
    anchor: [{ v: 0, steps: [0] }],
    hemiola: true,   // 12分割のトラックを1ループごとに1ステップ回し、16分割との 3:4 の重なりをずらしていく
    subDrone: 0.22,  // 基音のサブドローン（GARDEN BUS の基音・音階に従う）
    fx: { dly: 0.42, dfb: 0.58, dtime: 0.75, spr: 0.35, sc: 0, wow: 0, crsh: 0, lofi: 14000, crkl: 0, hiss: 0.004, throwZ: 0.9 },
  },
  IKD: {
    ...STYLE_CODES.IKD, voices: STYLE_TRACKS.IKD,
    bpm: 140, swg: 0.5, q: 1, div: [16, 64, 16, 64, 64, 32], lay: [0, 0, 0, 0, 0, 0], jit: [0, 0, 0, 0, 0, 0], trim: [1, 2.5, 1.5, 3, 1.4, 1.6],
    anchor: [{ v: 0, steps: [0] }],
    panHard: true,   // K 以外は左右に振り切る
    hiCap: 5,        // 高域トーン（T・H）の1小節あたりの音量の総量の上限
    fx: { dly: 0, dfb: 0, dtime: 0.25, spr: 0, sc: 0, wow: 0, crsh: 0, lofi: 20000, crkl: 0, hiss: 0, throwZ: 0 },
  },
  BDM: {
    ...STYLE_CODES.BDM, voices: STYLE_TRACKS.BDM,
    bpm: 88, swg: 0.62, q: 0.92, div: [16, 16, 16, 16, 16, 16], lay: [-4, 0, 24, 6, 10, 0], jit: [3, 4, 5, 9, 6, 8], trim: [1, 1.1, 3, 3.5, 3, 3.5],
    anchor: [{ v: 0, steps: [0] }, { v: 2, steps: [4, 12] }],
    vel16: true,     // MPC の16段階ベロシティ
    chop: true,      // T トラックは合成ループ（1小節）を16分割したチョップを鳴らす
    fx: { dly: 0.08, dfb: 0.3, dtime: 0.5, spr: 0, sc: 0.55, wow: 0, crsh: 10, lofi: 7600, crkl: 7, hiss: 0.014, throwZ: 0 },
  },
  JLN: {
    ...STYLE_CODES.JLN, voices: STYLE_TRACKS.JLN,
    bpm: 122, swg: 0.53, q: 0.8, div: [16, 16, 16, 64, 32, 32], lay: [0, 0, 0, 0, 0, 0], jit: [2, 6, 3, 3, 4, 5], trim: [1, 1.6, 4.5, 4.5, 3.5, 5],
    anchor: [{ v: 0, steps: [0] }],
    granular: true,  // T トラックは粒の長さ＝細胞の周長のグラニュラー
    click64: true,   // H トラックは64分のクリック層
    fx: { dly: 0.22, dfb: 0.42, dtime: 0.5, spr: 0.1, sc: 0, wow: 0.35, crsh: 0, lofi: 9500, crkl: 12, hiss: 0.02, throwZ: 0.3 },
  },
};
export const STYLE_IDS = Object.keys(STYLES);

// ループ長の選択肢（ステップ数）。BAR はスタイルの分割数 × 小節数
export const LOOP_LENGTHS = ['BAR', 16, 12, 10, 7];
