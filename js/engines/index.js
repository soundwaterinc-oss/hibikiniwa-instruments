// 音色エンジンの登録表。表示名・マクロの意味は codebook.js の ENGINE_CODES
import * as add from './add.js';
import * as sin from './sin.js';
import * as reese from './reese.js';
import * as fm2 from './fm2.js';
import * as fold from './fold.js';
import * as undr from './undr.js';
import * as ladder from './ladder.js';
import * as pwm from './pwm.js';
import * as organ from './organ.js';
import * as kargyraa from './kargyraa.js';
import * as didj from './didj.js';
import * as bow from './bow.js';
import * as tape from './tape.js';

export const ENGINES = { add, sin, reese, fm2, fold, undr, ladder, pwm, organ, kargyraa, didj, bow, tape };
export const ENGINE_IDS = Object.keys(ENGINES);

// 持続ボイス全体で使ってよい「音源コスト」（オシレータ＋揺らぎLFO）の上限
export const VOICE_BUDGET = 96;

export const getEngine = (id) => ENGINES[id] || ENGINES.add;
