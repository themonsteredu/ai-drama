# ai-drama / MOAKIT PLAY 분리 구조

## 목표

기존 `ai-drama`의 고전문학 각색·촬영·영상 합성 수업을 유지하면서, 같은 저장소에 초등 저학년도 사용할 수 있는 자유 연극 제작 앱을 추가한다.

```text
ai-drama/
├─ src/                         기존 고전문학 영상연극 앱
├─ apps/
│  └─ play-studio/              MOAKIT PLAY 독립 Next.js 앱
├─ packages/
│  └─ stage-core/               앱 간 공유할 무대 문서 타입과 순수 함수
└─ docs/
   └─ play-studio-architecture.md
```

## 1차 구현 원칙

- 기존 루트 앱의 파일, 의존성, pnpm lockfile, Vercel 설정을 수정하지 않는다.
- 새 앱은 `apps/play-studio`를 Root Directory로 별도 배포한다.
- `packages/stage-core`에는 UI나 Supabase 코드가 아니라 장면·요소·캐릭터 데이터 타입과 순수 편집 함수만 둔다.
- 새 앱이 공통 타입을 먼저 사용한다.
- 기존 `stage-editor.tsx`는 회귀 검증 환경이 준비된 뒤 공통 모듈로 단계적으로 옮긴다.

## 공통 데이터 모델

```text
StageProject
├─ cast[]
├─ scenes[]
│  ├─ backgroundId
│  └─ items[]
│     ├─ character
│     ├─ prop
│     └─ speech
└─ activeSceneId
```

모든 무대 요소는 퍼센트 좌표 `x`, `y`와 `scale`, `rotation`, `zIndex`를 사용한다. 이 형식은 기존 `ai-drama`의 `StageItem` 구조와 연결하기 쉽고, 태블릿과 노트북 화면 크기가 달라도 같은 구도를 유지할 수 있다.

## 단계별 통합

### Phase 1 — 안전한 별도 앱

- 자유 창작 UI
- 캐릭터 조립
- 배경·소품·대사
- 장면 관리
- localStorage 저장
- 발표 모드

### Phase 2 — 교육 운영 연결

- 수업 코드 입장
- 개인·모둠 모드
- 교사 작품 확인
- Supabase 저장
- 작품별 에셋 제한

### Phase 3 — 기존 앱과 엔진 공유

- 기존 무대 편집기의 좌표·레이어·undo/redo를 `stage-core` 어댑터에 연결
- Realtime 편집 잠금을 공통 훅으로 분리
- 기존 고전문학 앱 회귀 테스트 후 중복 코드 제거

### Phase 4 — 출력과 영상

- 장면 PNG
- 4컷 이야기
- A4 연극 기획서
- 녹음·장면 전환
- 기존 FFmpeg 영상 합성 모듈 선택 연결

## 배포 구조

```text
themonsteredu/ai-drama
├─ Vercel project: ai-drama
│  └─ Root Directory: ./
└─ Vercel project: moakit-play
   └─ Root Directory: apps/play-studio
```

두 앱은 같은 저장소의 변경 이력을 공유하지만 도메인과 빌드가 분리된다. 새 앱에서 문제가 생겨도 기존 고전문학 수업 주소에는 영향을 주지 않는다.
