// docs/CODEBOOK.md の STOMA//16 の章
import { mdTable } from '../packages/core/codebook.js';
import { PRODUCT, GROUP_CODES, OPTION_CODES, STYLE_CODES, STYLE_TRACKS, TRACK_CODES, MODEL_CODES, SECTION_CODES, TISSUE_COLOR_CODES, TISSUE_SIZE_CODES, SPECIMEN_CODES, STAT_CODES } from '../apps/stoma16/js/codebook.js';
import { PARAMS } from '../apps/stoma16/js/params.js';
import { registerOf } from '../packages/core/format.js';

export function renderStoma() {
  const L = [];
  L.push(`# ${PRODUCT.code}`, '', `**${PRODUCT.code}** = ${PRODUCT.plain}（\`apps/stoma16/js/codebook.js\`）`, '');
  L.push('## グループ', '', mdTable(['コード', '平文'], Object.values(GROUP_CODES).map((g) => [g.code, g.plain])), '');
  L.push('## パラメータ', '', mdTable(['レジスタ', 'コード', '内部キー', '平文', '範囲', '初期値', 'グループ'],
    PARAMS.map((p, i) => [registerOf(i), p.code, `\`${p.key}\``, p.plain, p.type === 'select' ? p.options.map((o) => o[1]).join(' / ') : `${p.min}〜${p.max}${p.unit ? ` ${p.unit}` : ''}`, p.def, GROUP_CODES[p.group].code])), '');
  L.push('### 選択肢', '', mdTable(['パラメータ', 'コード', '値', '平文'], Object.entries(OPTION_CODES).flatMap(([k, o]) => Object.entries(o).map(([v, [c, p]]) => [`\`${k}\``, c, `\`${v}\``, p]))), '');
  L.push('## スタイル', '', '各作家の手法を合成音で再現するスタディです（サンプルは使いません）。', '', mdTable(['コード', '参照', '平文'], Object.values(STYLE_CODES).map((s) => [s.code, s.name, s.plain])), '');
  L.push('## トラック', '', mdTable(['役割コード', '平文', '細胞の形', 'TWL', 'IKD', 'BDM', 'JLN'],
    TRACK_CODES.map((t, v) => [t.code, t.plain, t.role, ...['TWL', 'IKD', 'BDM', 'JLN'].map((s) => `${STYLE_TRACKS[s][v][0]}：${STYLE_TRACKS[s][v][1]}`)])), '');
  L.push('## 16音色とマクロ', '', mdTable(['コード', '平文', 'M1', 'M2'], Object.entries(MODEL_CODES).map(([c, m]) => [c, m.plain, `${m.macros[0][0]}：${m.macros[0][1]}`, `${m.macros[1][0]}：${m.macros[1][1]}`])), '');
  L.push('## EVO の区間', '', mdTable(['コード', '平文'], Object.values(SECTION_CODES).map((s) => [s.code, s.plain])), '');
  L.push('## 組織クラス', '', 'コード = `TIS.<色>-<大きさ>`（例 `TIS.R-sm` ＝赤・小さい）。同じ名前が重なると末尾に番号が付きます。', '',
    mdTable(['色', '平文'], Object.entries(TISSUE_COLOR_CODES)), '', mdTable(['大きさ', '平文'], Object.entries(TISSUE_SIZE_CODES)), '');
  L.push('## 標本', '', mdTable(['コード', '内部キー', '平文'], Object.entries(SPECIMEN_CODES).map(([k, s]) => [s.code, `\`${k}\``, s.plain])), '');
  L.push('## 統計の表示', '', mdTable(['コード', '平文'], Object.values(STAT_CODES).map((s) => [s.code, s.plain])), '');
  return L.join('\n').replace(/^(#{1,3}) /gm, '#$1 ');
}

// コードの一覧（一意性の検査用）
export function stomaCodes() {
  return [
    PRODUCT.code, ...Object.values(GROUP_CODES).map((g) => g.code), ...PARAMS.map((p) => p.code),
    ...Object.values(STYLE_CODES).map((s) => s.code), ...Object.keys(MODEL_CODES), ...Object.values(SECTION_CODES).map((s) => s.code),
    ...Object.values(SPECIMEN_CODES).map((s) => s.code), ...Object.values(STYLE_TRACKS).flat().map((t) => t[0]),
  ];
}
