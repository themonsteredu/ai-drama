# MOAKIT PLAY

`ai-drama` 저장소 안에서 별도로 배포하는 자유 연극 제작 앱입니다. 기존 고전문학 영상연극 앱은 루트에 그대로 두고, 이 앱은 `apps/play-studio`를 Vercel Root Directory로 사용합니다.

## 현재 구현

- 조립형 SVG 캐릭터 만들기: 피부색, 머리, 눈, 옷, 표정, 동작, 장식
- 캐릭터 보관함과 무대 재사용
- 교실·숲·우주·성·바닷가·빈 무대 배경
- 소품, 말풍선, 생각풍선, 장면 설명 배치
- 드래그 이동, 확대·축소, 회전, 앞뒤 순서, 복사, 삭제
- 최대 6개 장면, 장면 복사·삭제
- 실행 취소·다시 실행
- 브라우저 자동 저장
- 전체 화면 발표 모드
- 모바일·태블릿·노트북 반응형 UI

## 로컬 실행

저장소 루트의 기존 pnpm workspace에 아직 편입하지 않은 독립 앱입니다. 기존 운영 앱의 lockfile과 빌드를 건드리지 않기 위한 1차 안전 조치입니다.

```bash
cd apps/play-studio
pnpm install --ignore-workspace --no-frozen-lockfile
pnpm dev
```

## Vercel 설정

- Git Repository: `themonsteredu/ai-drama`
- Root Directory: `apps/play-studio`
- Framework: Next.js
- Install Command: `pnpm install --ignore-workspace --no-frozen-lockfile`
- Build Command: `pnpm build`

`vercel.json`에 동일한 명령이 포함되어 있습니다.

## 다음 단계

1. 실제 SVG/WebP 캐릭터·배경·소품 에셋팩 교체
2. 장면 PNG와 A4 연극 기획서 출력
3. 수업 코드·학생 작품·교사 대시보드 연결
4. Supabase 저장 및 공동 편집
5. 기존 `ai-drama` 무대 편집기를 `packages/stage-core`에 단계적으로 연결
