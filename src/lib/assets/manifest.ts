import { CLASSIC_WORKS, getVariant } from "@/lib/seed";
import type { AssetCategory, StageAsset, WorkId } from "@/lib/types";

function stageAssetUrl(publicPath: string) {
  return `/api/stage-assets/${publicPath.replace(/^\/assets\//, "")}`;
}

const buildingByWork: Record<WorkId, { title: string; filePath: string }> = {
  heungbu: { title: "흥부의 초가집", filePath: "/assets/shared/buildings/thatched-house.webp" },
  chunhyang: { title: "변학도의 관아", filePath: "/assets/shared/buildings/government-hall.webp" },
  honggildong: { title: "홍 판서댁 대문", filePath: "/assets/shared/buildings/gate.webp" },
  simcheong: { title: "궁궐 전각", filePath: "/assets/shared/buildings/government-hall.webp" },
  byeoljubu: { title: "용궁 전각", filePath: "/assets/shared/buildings/government-hall.webp" },
  jeonwoochi: { title: "권력자의 대문", filePath: "/assets/shared/buildings/gate.webp" },
};

const propByWork: Record<WorkId, { title: string; filePath: string }> = {
  heungbu: { title: "빈 쌀그릇", filePath: "/assets/shared/props/rice-bowl.webp" },
  chunhyang: { title: "암행어사 마패 두루마리", filePath: "/assets/shared/props/royal-scroll.webp" },
  honggildong: { title: "결심의 두루마리", filePath: "/assets/shared/props/royal-scroll.webp" },
  simcheong: { title: "심 봉사의 밥그릇", filePath: "/assets/shared/props/rice-bowl.webp" },
  byeoljubu: { title: "토끼의 꾀 주머니", filePath: "/assets/shared/props/royal-scroll.webp" },
  jeonwoochi: { title: "전우치의 마법 부채", filePath: "/assets/shared/props/magic-fan.webp" },
};

const backgroundTitles: Record<WorkId, [string, string, string]> = {
  heungbu: ["흥부의 초가 마당", "놀부의 기와집 마당", "흥부의 초가집 안"],
  chunhyang: ["달빛 아래 관아", "옥사와 관아 뜰", "춘향의 옥사 안"],
  honggildong: ["홍 판서댁 뜰", "홍 판서댁 대청", "활빈당 숲 훈련장"],
  simcheong: ["인당수 해안", "인당수로 가는 배", "심청의 궁궐 재회실"],
  byeoljubu: ["용궁으로 가는 길", "용궁 왕좌실", "산호 동굴 정원"],
  jeonwoochi: ["마법이 흐르는 저잣거리", "권력자의 관아 뜰", "달빛 궁궐 지붕"],
};

function asset(
  workId: WorkId,
  id: string,
  category: AssetCategory,
  title: string,
  filePath: string,
  defaultScale: number,
  placeholderColor: string,
  tags: string[],
): StageAsset {
  return {
    id: `${workId}-${id}`,
    category,
    title,
    filePath: stageAssetUrl(filePath),
    width: category === "background" ? 960 : 512,
    height: category === "background" ? 540 : 512,
    defaultScale,
    facingOptions: ["left", "right"],
    allowedRotations: category === "effect" ? [-15, 0, 15] : [0],
    workId,
    tags,
    placeholderColor,
  };
}

export const ASSET_MANIFEST: StageAsset[] = CLASSIC_WORKS.flatMap((work) => {
  const coreCharacters = getVariant(work.id, 6)?.characters ?? [];
  const building = buildingByWork[work.id];
  const prop = propByWork[work.id];
  return [
    ...backgroundTitles[work.id].map((title, index) => asset(work.id, `background-0${index + 1}`, "background", title, `/assets/classics/${work.id}/backgrounds/scene-0${index + 1}.webp`, 1, "#1e3a5f", ["촬영 세트", "배경", "16:9"])),
    asset(work.id, "building-01", "building", building.title, building.filePath, 0.48, "#8b5e3c", ["건물", "촬영 구도"]),
    ...coreCharacters.map((character, index) => asset(work.id, `character-0${index + 1}`, "character", character.name, `/assets/classics/${work.id}/characters/character-0${index + 1}.webp`, 0.42, "#c7826b", ["배우", "동선", character.name])),
    asset(work.id, "prop-01", "prop", prop.title, prop.filePath, 0.3, "#d8a632", ["핵심 소품", "손소품"]),
    asset(work.id, "animal-01", "animal", "장면을 살리는 강아지", "/assets/shared/animals/spotted-dog.webp", 0.28, "#a87c5a", ["동물", "반응"]),
    asset(work.id, "nature-01", "nature", "굽은 소나무", "/assets/shared/nature/pine-tree.webp", 0.42, "#527554", ["자연", "공간"]),
    asset(work.id, "nature-02", "nature", "무대 바위", "/assets/shared/nature/rock.webp", 0.28, "#6f7379", ["자연", "전경"]),
    asset(work.id, "effect-01", "effect", "마법의 바람", "/assets/shared/effects/magic-wind.webp", 0.36, "#7197c9", ["효과", "강조"]),
  ];
});

export const SHARED_ASSETS: StageAsset[] = [
  { id: "shared-folding-screen", category: "prop", title: "산수화 병풍", filePath: stageAssetUrl("/assets/shared/props/folding-screen.webp"), width: 512, height: 512, defaultScale: 0.42, facingOptions: ["left", "right"], allowedRotations: [0], workId: "shared", tags: ["실내", "무대"], placeholderColor: "#a98b62" },
  { id: "shared-wooden-table", category: "prop", title: "전통 나무 탁자", filePath: stageAssetUrl("/assets/shared/props/wooden-table.webp"), width: 512, height: 512, defaultScale: 0.34, facingOptions: ["left", "right"], allowedRotations: [0], workId: "shared", tags: ["실내", "소품"], placeholderColor: "#76543b" },
  { id: "shared-prison-bars", category: "building", title: "옥사 나무문", filePath: stageAssetUrl("/assets/shared/buildings/prison-bars.webp"), width: 512, height: 512, defaultScale: 0.52, facingOptions: ["left", "right"], allowedRotations: [0], workId: "shared", tags: ["옥사", "건물"], placeholderColor: "#5f4635" },
  { id: "shared-royal-throne", category: "building", title: "용상과 단상", filePath: stageAssetUrl("/assets/shared/buildings/royal-throne.webp"), width: 512, height: 512, defaultScale: 0.44, facingOptions: ["left", "right"], allowedRotations: [0], workId: "shared", tags: ["궁궐", "권력"], placeholderColor: "#8b4a32" },
  { id: "shared-market-stall", category: "building", title: "저잣거리 좌판", filePath: stageAssetUrl("/assets/shared/buildings/market-stall.webp"), width: 512, height: 512, defaultScale: 0.48, facingOptions: ["left", "right"], allowedRotations: [0], workId: "shared", tags: ["시장", "건물"], placeholderColor: "#9d7752" },
  { id: "shared-wooden-boat", category: "prop", title: "전통 나무배", filePath: stageAssetUrl("/assets/shared/props/wooden-boat.webp"), width: 512, height: 512, defaultScale: 0.48, facingOptions: ["left", "right"], allowedRotations: [0], workId: "shared", tags: ["바다", "이동"], placeholderColor: "#72523c" },
  { id: "shared-rice-sack", category: "prop", title: "쌀가마니", filePath: stageAssetUrl("/assets/shared/props/rice-sack.webp"), width: 512, height: 512, defaultScale: 0.28, facingOptions: ["left", "right"], allowedRotations: [0], workId: "shared", tags: ["곡식", "생활"], placeholderColor: "#b99461" },
  { id: "shared-treasure-chest", category: "prop", title: "보물 궤짝", filePath: stageAssetUrl("/assets/shared/props/treasure-chest.webp"), width: 512, height: 512, defaultScale: 0.34, facingOptions: ["left", "right"], allowedRotations: [0], workId: "shared", tags: ["재물", "소품"], placeholderColor: "#634632" },
  { id: "shared-water-jar", category: "prop", title: "옹기 물항아리", filePath: stageAssetUrl("/assets/shared/props/water-jar.webp"), width: 512, height: 512, defaultScale: 0.3, facingOptions: ["left", "right"], allowedRotations: [0], workId: "shared", tags: ["생활", "소품"], placeholderColor: "#7d5b46" },
  { id: "shared-paper-lantern", category: "prop", title: "전통 등불", filePath: stageAssetUrl("/assets/shared/props/paper-lantern.webp"), width: 512, height: 512, defaultScale: 0.3, facingOptions: ["left", "right"], allowedRotations: [0], workId: "shared", tags: ["조명", "밤"], placeholderColor: "#e2bb72" },
  { id: "shared-rope-coil", category: "prop", title: "새끼줄", filePath: stageAssetUrl("/assets/shared/props/rope-coil.webp"), width: 512, height: 512, defaultScale: 0.27, facingOptions: ["left", "right"], allowedRotations: [0], workId: "shared", tags: ["배", "생활"], placeholderColor: "#a9855d" },
  { id: "shared-joseon-sword", category: "prop", title: "조선 환도", filePath: stageAssetUrl("/assets/shared/props/joseon-sword.webp"), width: 512, height: 512, defaultScale: 0.3, facingOptions: ["left", "right"], allowedRotations: [-15, 0, 15], workId: "shared", tags: ["결투", "손소품"], placeholderColor: "#3f4651" },
  { id: "shared-buk-drum", category: "prop", title: "전통 북", filePath: stageAssetUrl("/assets/shared/props/buk-drum.webp"), width: 512, height: 512, defaultScale: 0.33, facingOptions: ["left", "right"], allowedRotations: [0], workId: "shared", tags: ["음악", "신호"], placeholderColor: "#7a4b35" },
  { id: "shared-magpie", category: "animal", title: "날아드는 까치", filePath: stageAssetUrl("/assets/shared/animals/magpie.webp"), width: 512, height: 512, defaultScale: 0.25, facingOptions: ["left", "right"], allowedRotations: [-15, 0, 15], workId: "shared", tags: ["동물", "소식"], placeholderColor: "#34495f" },
];

export function getAssetsForWork(workId: WorkId) {
  return [...ASSET_MANIFEST.filter((item) => item.workId === workId), ...SHARED_ASSETS];
}

export function getAsset(assetId: string) {
  return [...ASSET_MANIFEST, ...SHARED_ASSETS].find((item) => item.id === assetId);
}

export function getCharacterPortrait(workId: WorkId, characterId: string) {
  const roleNumber = Number(characterId.match(/role-(\d+)$/)?.[1] ?? 1);
  const portraitNumber = Math.min(6, Math.max(1, roleNumber));
  return stageAssetUrl(`/assets/classics/${workId}/characters/character-0${portraitNumber}.webp`);
}
