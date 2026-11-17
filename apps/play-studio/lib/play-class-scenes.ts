export const CLASS_SCENE_NUMBERS = [1, 2, 3, 4, 5] as const;
export type ClassSceneNumber = typeof CLASS_SCENE_NUMBERS[number];

export function isClassSceneNumber(value: unknown): value is ClassSceneNumber {
  return CLASS_SCENE_NUMBERS.some(number => number === value);
}

export type SavedSceneProject = {
  id: string;
  classId: string;
  classTitle: string;
  group: number;
  scene: ClassSceneNumber;
  title: string;
  scenes: number;
  updatedAt: string;
};

export type SavedScenePage = {projects: SavedSceneProject[]; next: string | null};
