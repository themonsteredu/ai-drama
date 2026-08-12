export type WorkId =
  | "heungbu"
  | "chunhyang"
  | "honggildong"
  | "simcheong"
  | "byeoljubu"
  | "jeonwoochi";

export type TeamSize = 4 | 5 | 6;
export type TeamPhase =
  | "work-selection"
  | "role-assignment"
  | "script"
  | "stage"
  | "music"
  | "recording"
  | "rendering"
  | "submitted";
export type RecordingStatus = "not-recorded" | "recorded" | "retake" | "confirmed";
export type AssetCategory =
  | "background"
  | "building"
  | "character"
  | "prop"
  | "animal"
  | "nature"
  | "effect";
export type ProductionRole =
  | "연출"
  | "각색/시나리오"
  | "촬영관리"
  | "장면관리/편집관리"
  | "소품/무대관리"
  | "기록/진행";

export interface CharacterTemplate {
  id: string;
  name: string;
  personality: string[];
  actionCue: string;
  lineCue: string;
}

export interface DialogueTemplateLine {
  speakerCharacterId: string;
  speakerName: string;
  text: string;
  direction: string;
}

export interface DialogueLine extends DialogueTemplateLine {
  id: string;
}

export interface SpeakerCue {
  id: string;
  characterId: string;
  characterName: string;
  studentName: string;
  atMs: number;
  text?: string;
}

export interface CutTemplate {
  order: number;
  title: string;
  summary: string;
  activeCharacters: string[];
  emotion: string[];
  linePrompt: string;
  props: string[];
  atmosphere: string;
  modelDialogue: DialogueTemplateLine[];
}

export interface WorkVariant {
  teamSize: TeamSize;
  characters: CharacterTemplate[];
  cuts: CutTemplate[];
}

export interface ClassicWork {
  id: WorkId;
  title: string;
  tagline: string;
  easyContext: string;
  highlightTitle: string;
  sceneContext: string;
  color: string;
  accent: string;
  props: string[];
  backgrounds: string[];
  emotions: string[];
  bgmKeywords: string[];
  variants: Record<TeamSize, WorkVariant>;
}

export interface Student {
  id: string;
  name: string;
  teamId: string;
  characterId?: string;
  productionRole?: ProductionRole;
}

export interface ScriptCut extends CutTemplate {
  id: string;
  participants: string[];
  keyLine: string;
  dialogueLines: DialogueLine[];
  notes: string;
  confirmed: boolean;
}

export interface StageAsset {
  id: string;
  category: AssetCategory;
  title: string;
  filePath: string;
  width: number;
  height: number;
  defaultScale: number;
  facingOptions: Array<"left" | "right">;
  allowedRotations: number[];
  workId: WorkId | "shared";
  tags: string[];
  placeholderColor: string;
}

export interface StageItem {
  id: string;
  cutId: string;
  assetId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  facing: "left" | "right";
  pose?: "standing" | "sitting" | "kneeling";
  zIndex: number;
  lockedBy?: string;
}

export interface MusicCandidate {
  id: string;
  teamId: string;
  studentId: string;
  title: string;
  source: "upload" | "link";
  url: string;
  mood: string;
  votes: string[];
}

export interface CutRecording {
  cutId: string;
  status: RecordingStatus;
  videoUrl?: string;
  videoName?: string;
  dubbingUrl?: string;
  duration?: number;
  speakerCues?: SpeakerCue[];
}

export interface Team {
  id: string;
  classId: string;
  code: string;
  name: string;
  size: TeamSize;
  phase: TeamPhase;
  workId?: WorkId;
  customCharacters: CharacterTemplate[];
  students: Student[];
  scripts: ScriptCut[];
  stageItems: Record<string, StageItem[]>;
  stageConfirmed: string[];
  musicCandidates: MusicCandidate[];
  selectedMusicId?: string;
  bgmVolume: number;
  recordings: CutRecording[];
  finalVideoUrl?: string;
  submittedAt?: string;
}

export interface Classroom {
  id: string;
  schoolName: string;
  name: string;
  teacherName: string;
  adminCode: string;
  teams: Team[];
}

export interface PresenceMember {
  id: string;
  name: string;
  color: string;
  activeItemId?: string;
}
