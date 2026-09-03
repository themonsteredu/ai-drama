export const STAGE_PROJECT_VERSION = 1 as const;

export type StageItemKind = "character" | "prop" | "speech";
export type CharacterPose = "standing" | "waving" | "pointing" | "sitting";
export type CharacterExpression = "happy" | "sad" | "angry" | "surprised" | "thinking";
export type HairStyle = "short" | "bob" | "curly" | "ponytail";
export type EyeStyle = "round" | "smile" | "sparkle";
export type CharacterAccessory = "none" | "glasses" | "hair-bow" | "cap";
export type SpeechVariant = "speech" | "thought" | "caption";

export interface CharacterAppearance {
  skinTone: string;
  hairStyle: HairStyle;
  hairColor: string;
  eyeStyle: EyeStyle;
  topColor: string;
  bottomColor: string;
  accessory: CharacterAccessory;
}

export interface SavedCharacter {
  id: string;
  name: string;
  appearance: CharacterAppearance;
  expression: CharacterExpression;
  pose: CharacterPose;
}

export interface BaseStageItem {
  id: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
}

export interface CharacterStageItem extends BaseStageItem {
  kind: "character";
  data: SavedCharacter & { facing: "left" | "right" };
}

export interface PropStageItem extends BaseStageItem {
  kind: "prop";
  data: {
    catalogId: string;
    label: string;
    symbol: string;
  };
}

export interface SpeechStageItem extends BaseStageItem {
  kind: "speech";
  data: {
    text: string;
    variant: SpeechVariant;
  };
}

export type StageItem = CharacterStageItem | PropStageItem | SpeechStageItem;

export interface StageScene {
  id: string;
  title: string;
  backgroundId: string;
  items: StageItem[];
}

export interface StageProject {
  version: typeof STAGE_PROJECT_VERSION;
  id: string;
  title: string;
  activeSceneId: string;
  cast: SavedCharacter[];
  scenes: StageScene[];
  updatedAt: string;
}

export function createStageId(prefix = "stage") {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${uuid ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function clampStageCoordinate(value: number) {
  return clamp(value, 2, 98);
}

export function nextStageZIndex(items: StageItem[]) {
  return Math.max(0, ...items.map((item) => item.zIndex)) + 1;
}

export function patchStageItem(
  items: StageItem[],
  itemId: string,
  patch: Partial<Pick<BaseStageItem, "x" | "y" | "scale" | "rotation" | "zIndex">>,
) {
  return items.map((item) => (item.id === itemId ? { ...item, ...patch } : item));
}

export function removeStageItem(items: StageItem[], itemId: string) {
  return items.filter((item) => item.id !== itemId);
}

export function reorderStageItems(items: StageItem[], itemId: string, direction: -1 | 1) {
  const ordered = [...items].sort((a, b) => a.zIndex - b.zIndex);
  const currentIndex = ordered.findIndex((item) => item.id === itemId);
  if (currentIndex < 0) return items;

  const targetIndex = clamp(currentIndex + direction, 0, ordered.length - 1);
  if (targetIndex === currentIndex) return items;

  const [current] = ordered.splice(currentIndex, 1);
  ordered.splice(targetIndex, 0, current);
  return ordered.map((item, index) => ({ ...item, zIndex: index + 1 }));
}

export function duplicateStageScene(scene: StageScene, title?: string): StageScene {
  return {
    ...scene,
    id: createStageId("scene"),
    title: title ?? `${scene.title} 복사본`,
    items: scene.items.map((item) => ({
      ...item,
      id: createStageId(item.kind),
      data: { ...item.data },
    })) as StageItem[],
  };
}

export function isStageProject(value: unknown): value is StageProject {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StageProject>;
  return candidate.version === STAGE_PROJECT_VERSION
    && typeof candidate.id === "string"
    && typeof candidate.title === "string"
    && typeof candidate.activeSceneId === "string"
    && Array.isArray(candidate.cast)
    && Array.isArray(candidate.scenes)
    && candidate.scenes.length > 0;
}
