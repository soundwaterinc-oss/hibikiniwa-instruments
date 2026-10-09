// docs/CODEBOOK.md の本文を組み立てる（scripts/codebook.mjs と tests から使う）
import { PRODUCT, GROUP_CODES, STATE_CODES, OPTION_CODES, ENGINE_CODES, REGION_CODES, TUNING_CODES, SCENE_CODES, LEGACY_KEYS, scaleCode, registerOf } from '../js/codebook.js';
import { PARAMS, SCENES } from '../js/params.js';
import { SCALES } from '../js/scales.js';

const esc = (s) => String(s).replace(/\|/g, '\\|');
const row = (...cells) => `| ${cells.map(esc).join(' | ')} |`;

export function renderCodebook() {
  const L = [];
  L.push(`# CODEBOOK — ${PRODUCT.code}`, '');
  L.push('> このファイルは `node scripts/codebook.mjs` で `js/codebook.js` から自動生成しています。手で編集しないでください。', '');
  L.push(`**${PRODUCT.code}** = ${PRODUCT.plain}`, '');
  L.push('UIでは [DECODE] を押すと、すべてのラベルにここの平文が併記されます。各コントロールの `title` と `aria-label` には常に平文が入っています。安全注意だけは暗号化していません。', '');

  L.push('## グループ', '', row('コード', '平文'), row('---', '---'));
  for (const g of Object.values(GROUP_CODES)) L.push(row(g.code, g.plain));
  L.push('');

  L.push('## パラメータ', '', row('レジスタ', 'コード', '内部キー', '平文', '範囲', '初期値', 'グループ'), row('---', '---', '---', '---', '---', '---', '---'));
  PARAMS.forEach((p, i) => {
    const range = p.type === 'select' ? p.options.join(' / ') : `${p.min}〜${p.max}${p.unit ? ` ${p.unit}` : ''}`;
    L.push(row(registerOf(i), p.code, `\`${p.key}\``, p.plain, range, p.def, GROUP_CODES[p.group].code));
  });
  L.push('');
  L.push('### 状態（スライダー以外）', '', row('コード', '内部キー', '平文'), row('---', '---', '---'));
  for (const [k, s] of Object.entries(STATE_CODES)) L.push(row(s.code, `\`${k}\``, s.plain));
  L.push('');
  L.push('### 選択肢', '', row('パラメータ', 'コード', '値', '平文'), row('---', '---', '---', '---'));
  for (const [key, opts] of Object.entries(OPTION_CODES)) for (const [v, o] of Object.entries(opts)) L.push(row(`\`${key}\``, o.code, `\`${v}\``, o.plain));
  L.push('');

  L.push('## 音色エンジン（§0x3 GEN / ENG）', '', '各エンジンは共通マクロ Α・Β・Γ（0〜1）に別々の意味を割り当てます。', '');
  L.push(row('コード', '内部キー', '平文', 'Α', 'Β', 'Γ'), row('---', '---', '---', '---', '---', '---'));
  for (const [id, e] of Object.entries(ENGINE_CODES)) L.push(row(e.code, `\`${id}\``, e.plain, ...e.macros.map(([c, p]) => `${c}：${p}`)));
  L.push('');

  L.push('## 音階', '', 'コード = 地域（＋略称）- 音数 / 調律記号', '');
  L.push(row('地域コード', '平文'), row('---', '---'));
  for (const [plain, code] of Object.entries(REGION_CODES)) L.push(row(code, plain));
  L.push('');
  L.push(row('調律記号', '平文'), row('---', '---'));
  for (const [code, plain] of Object.entries(TUNING_CODES)) L.push(row(code, plain));
  L.push('');
  L.push(row('コード', '内部キー', '平文', '地域', '調律'), row('---', '---', '---', '---', '---'));
  for (const s of SCALES) L.push(row(scaleCode(s.id, s.cents.length), `\`${s.id}\``, s.name, s.region, s.tuning));
  L.push(row('USR-n/X', '`custom`', 'カスタム（セント・比率・.scl）', '自作', '—'));
  L.push('');

  L.push('## プログラム（シーン）', '', row('コード', '内部キー', '平文', '内容'), row('---', '---', '---', '---'));
  for (const sc of SCENES) L.push(row(SCENE_CODES[sc.id].code, `\`${sc.id}\``, SCENE_CODES[sc.id].plain, sc.desc));
  L.push('');

  L.push('## v1（KUKURU）→ v2 のキー対応', '', '旧 `kukuru-drone:v1` の保存や version 1 のJSONは、読み込み時にこの表で変換します。基音は 20〜250Hz にオクターブ単位で折り畳み、キャリアは120Hz以上にします。', '');
  L.push(row('v1', 'v2', 'コード'), row('---', '---', '---'));
  const codeOf = (k) => PARAMS.find((p) => p.key === k)?.code || STATE_CODES[k]?.code || '';
  for (const [a, b] of Object.entries(LEGACY_KEYS)) L.push(row(`\`${a}\``, `\`${b}\``, codeOf(b)));
  L.push('');
  return L.join('\n');
}
