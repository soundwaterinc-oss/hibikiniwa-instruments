// テスト用：fixtures/ の実写真を読む（リポジトリには含めない。無い環境ではテストをスキップ）
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const fixturePath = (name) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
export const hasFixture = (name) => existsSync(fixturePath(name));

export async function loadFixture(name) {
  const { loadImage, createCanvas } = await import('@napi-rs/canvas');
  const im = await loadImage(fixturePath(name));
  const c = createCanvas(im.width, im.height);
  const g = c.getContext('2d');
  g.drawImage(im, 0, 0);
  return { width: im.width, height: im.height, data: g.getImageData(0, 0, im.width, im.height).data };
}
