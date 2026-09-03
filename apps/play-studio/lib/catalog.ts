import type {
  CharacterAccessory,
  CharacterExpression,
  CharacterPose,
  EyeStyle,
  HairStyle,
  SpeechVariant,
} from "@moakit/stage-core";

export interface Choice<T extends string> {
  id: T;
  label: string;
}

export interface BackgroundChoice {
  id: string;
  label: string;
  description: string;
}

export interface PropChoice {
  id: string;
  label: string;
  symbol: string;
}

export const backgrounds: BackgroundChoice[] = [
  { id: "classroom", label: "교실", description: "발표와 학교 이야기" },
  { id: "forest", label: "숲", description: "모험과 동화 장면" },
  { id: "space", label: "우주", description: "상상과 미래 이야기" },
  { id: "castle", label: "성", description: "왕국과 전설 이야기" },
  { id: "beach", label: "바닷가", description: "여행과 여름 이야기" },
  { id: "blank", label: "빈 무대", description: "소품으로 직접 꾸미기" },
];

export const propChoices: PropChoice[] = [
  { id: "book", label: "책", symbol: "책" },
  { id: "chair", label: "의자", symbol: "의" },
  { id: "tree", label: "나무", symbol: "木" },
  { id: "gift", label: "선물 상자", symbol: "선" },
  { id: "balloon", label: "풍선", symbol: "○" },
  { id: "star", label: "별", symbol: "★" },
  { id: "dog", label: "강아지", symbol: "강" },
  { id: "robot", label: "로봇", symbol: "R" },
  { id: "magnifier", label: "돋보기", symbol: "⌕" },
  { id: "door", label: "문", symbol: "門" },
  { id: "box", label: "상자", symbol: "□" },
  { id: "microphone", label: "마이크", symbol: "M" },
];

export const skinTones = ["#f8d9c0", "#eebf9e", "#d99a72", "#ad694b", "#754331"];
export const hairColors = ["#221b18", "#51362c", "#8c5a35", "#d3a54f", "#4a416f"];
export const topColors = ["#3c6ee8", "#f06473", "#7d4bc4", "#20a47a", "#f29b38", "#26324a"];
export const bottomColors = ["#243457", "#5573a5", "#7c4d36", "#5d6575", "#303239"];

export const hairStyles: Choice<HairStyle>[] = [
  { id: "short", label: "짧은 머리" },
  { id: "bob", label: "단발" },
  { id: "curly", label: "곱슬" },
  { id: "ponytail", label: "묶은 머리" },
];

export const eyeStyles: Choice<EyeStyle>[] = [
  { id: "round", label: "동그란 눈" },
  { id: "smile", label: "웃는 눈" },
  { id: "sparkle", label: "반짝이는 눈" },
];

export const accessories: Choice<CharacterAccessory>[] = [
  { id: "none", label: "없음" },
  { id: "glasses", label: "안경" },
  { id: "hair-bow", label: "리본" },
  { id: "cap", label: "모자" },
];

export const expressions: Choice<CharacterExpression>[] = [
  { id: "happy", label: "기쁨" },
  { id: "sad", label: "슬픔" },
  { id: "angry", label: "화남" },
  { id: "surprised", label: "놀람" },
  { id: "thinking", label: "생각" },
];

export const poses: Choice<CharacterPose>[] = [
  { id: "standing", label: "서기" },
  { id: "waving", label: "손 흔들기" },
  { id: "pointing", label: "가리키기" },
  { id: "sitting", label: "앉기" },
];

export const speechVariants: Choice<SpeechVariant>[] = [
  { id: "speech", label: "말풍선" },
  { id: "thought", label: "생각풍선" },
  { id: "caption", label: "장면 설명" },
];
