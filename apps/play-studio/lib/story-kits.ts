import type {DrawingKind} from '../../../packages/stage-core/src/drawing';

/**
 * A story kit carries only the facts of a story a class has already read together:
 * who is in it, where it happens, and what the scenes feel like. No artwork travels
 * with it — the child draws each character, which is the point of the textbook unit.
 */
export type StoryCharacter={name:string;kind:DrawingKind;hint:string};
export type StoryPlace={name:string;hint:string};
export type StoryMood={name:string;trackId:string};
export type StoryKit={
 id:string;
 title:string;
 /** Shown with the kit so the work and its authors stay named. */
 credit:string;
 lesson:string;
 intro:string;
 characters:StoryCharacter[];
 places:StoryPlace[];
 moods:StoryMood[];
};

export const storyKits:StoryKit[]=[
 {
  id:'binjip',
  title:'빈집에 온 손님',
  credit:'글 황선미 · 그림 김중석',
  lesson:'2학년 국어 8. 이어질 이야기 상상하기',
  intro:'이야기에 나온 인물과 곳이에요. 하나를 고르고, 내가 그린 그림을 올려 그 자리에 놓아요.',
  characters:[
   {name:'금방울',kind:'animal',hint:'맏이. 동생들을 돌봐요'},
   {name:'은방울',kind:'animal',hint:'가운데. 물을 뜨러 가요'},
   {name:'작은방울',kind:'animal',hint:'막내. 겁이 많아요'},
   {name:'엄마',kind:'animal',hint:'집을 비운 엄마'},
   {name:'아빠',kind:'animal',hint:'집을 비운 아빠'},
   {name:'할머니',kind:'animal',hint:'댁에 가신 할머니'},
   {name:'낯선 손님',kind:'animal',hint:'문을 두드린 손님'},
  ],
  places:[
   {name:'들판 언덕길',hint:'바람이 불어오는 길'},
   {name:'빈집 앞',hint:'문 앞에서 기다려요'},
   {name:'물레방앗간',hint:'물을 뜨는 곳'},
   {name:'방 안',hint:'담요를 덮고 있어요'},
   {name:'밤길',hint:'창에 불이 켜졌어요'},
  ],
  moods:[
   {name:'무서움',trackId:'music-tension'},
   {name:'걱정',trackId:'music-sad'},
   {name:'반가움',trackId:'music-happy'},
   {name:'안심',trackId:'music-calm'},
  ],
 },
];
