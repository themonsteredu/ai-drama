import type { StageItem } from "@/lib/types";

const POSE_ROTATION_OFFSET = {
  standing: 0,
  sitting: 1000,
  kneeling: 2000,
} as const;

// Pose values use an unused high rotation range so existing databases need no migration.
export function encodeStageItemsForStorage(items: StageItem[]) {
  return items.map((item) => ({
    ...item,
    rotation: item.rotation + POSE_ROTATION_OFFSET[item.pose ?? "standing"],
  }));
}
