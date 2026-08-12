import { ASSET_MANIFEST } from "../src/lib/assets/manifest";
import { CLASSIC_WORKS } from "../src/lib/seed";

const errors: string[] = [];
if (CLASSIC_WORKS.length !== 6) errors.push(`작품 수가 6이 아닙니다: ${CLASSIC_WORKS.length}`);
for (const work of CLASSIC_WORKS) {
  for (const size of [4,5,6] as const) {
    const variant = work.variants[size];
    if (variant.characters.length !== size) errors.push(`${work.title} ${size}인 등장인물 수 오류`);
    if (variant.cuts.length !== size) errors.push(`${work.title} ${size}인 컷 수 오류`);
    for (const character of variant.characters) {
      const active = variant.cuts.some((cut) => cut.activeCharacters.includes(character.name));
      if (!active || !character.actionCue || !character.lineCue) errors.push(`${work.title} ${size}인 ${character.name}에게 대사/행동/등장 컷이 없습니다.`);
    }
  }
  if (!ASSET_MANIFEST.some((asset) => asset.workId === work.id)) errors.push(`${work.title} 에셋이 없습니다.`);
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`검증 완료: ${CLASSIC_WORKS.length}작품 · 18개 인원별 버전 · ${ASSET_MANIFEST.length}개 에셋 슬롯`);
