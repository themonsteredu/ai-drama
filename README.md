# 문학이 무대가 되는 순간

고전문학의 하이라이트 한 장면을 학생이 직접 각색·연기·촬영하고, 시스템이 오프닝·배경음악·엔딩 크레딧을 자동으로 이어 붙이는 교육용 영상연극 제작 웹앱입니다.

AI가 작품을 대신 생성하지 않습니다. 모든 학생은 `배우 1역 + 제작역할 1개 + 음악 후보 1곡`을 맡고, `모둠 인원 수 = 등장인물 수 = 컷 수` 규칙을 끝까지 유지합니다.

## 구현 범위

- 교사 수업 정보 편집, 4/5/6인 모둠과 코드 생성, 진행 현황 대시보드
- 모둠 코드 + 이름 기반 학생 입장(Supabase 연결 시 Anonymous Auth + `join_team` RPC)
- 흥부전·춘향전·홍길동전·심청전·별주부전·전우치전 6작품 seed
- 작품마다 4/5/6인 등장인물·컷 템플릿(총 18개 variant)
- 전원 배역·제작역할 중복 방지 배정
- 활동지와 동일한 컷별 시나리오 입력 및 인쇄용 2쪽 활동지
- 쉬운 장면 보드형 공동 무대 편집: 이동, 크기, 방향, 레이어, 삭제, undo/redo, 확정
- Supabase Realtime Presence/Broadcast, stage item 영속화 RPC, 편집 점유 표시
- 학생별 Suno 링크/음원 업로드, 블라인드 투표, 최종 BGM 확정
- MediaRecorder 기반 컷별 촬영, 다시찍기, 미리보기, 확정, 선택 후시녹음
- ffmpeg.wasm 지연 로딩 자동 MP4 합성(오프닝 → CAST → 컷 → BGM → 크레딧)
- Supabase Storage 업로드 및 교사용 작품관 제출
- 제출 작품 자동 연속 재생/전체 화면 시사회
- Supabase가 없어도 바로 작동하는 localStorage + BroadcastChannel 데모 모드

## 기술 스택

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS 4
- Zustand persist
- Supabase Database, Anonymous Auth, Realtime, Storage
- `@ffmpeg/ffmpeg`, `@ffmpeg/util`
- MediaRecorder / MediaDevices Web API

## 로컬 실행

Node.js 22+와 pnpm 11을 권장합니다.

```bash
pnpm install
pnpm dev
```

`http://localhost:3000`을 엽니다. Supabase 환경변수가 없으면 데모 모드로 자동 실행됩니다.

데모 계정:

| 구분 | 코드 | 이름 예시 | 현재 단계 |
| --- | --- | --- | --- |
| 달빛극단 | `MOON24` | `민서` | 시나리오 |
| 물결스튜디오 | `WAVE55` | `하린` | 무대꾸미기 |
| 별무대 | `STAR66` | `예준` | 촬영 |
| 교사 | `STAGE2026` | - | 대시보드 |

## 환경변수

`.env.example`을 `.env.local`로 복사하고 값을 채웁니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
TEACHER_ADMIN_CODE=운영용-관리자-코드

# 선택: 비우면 기본 unpkg CDN 사용
NEXT_PUBLIC_FFMPEG_CORE_BASE_URL=https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm

# 선택: 서버/Edge Function 렌더 워커
VIDEO_RENDER_WEBHOOK_URL=
VIDEO_RENDER_WEBHOOK_SECRET=
```

`SUPABASE_SERVICE_ROLE_KEY`, `TEACHER_ADMIN_CODE`, `VIDEO_RENDER_WEBHOOK_SECRET`은 서버 전용이며 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.

Vercel 배포에는 앞의 네 값(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TEACHER_ADMIN_CODE`)을 Production 환경변수로 넣으면 됩니다. 데모 모드 플래그는 따로 없으며, Supabase URL/anon key가 있으면 DB 모드, 없으면 내장 데모 모드로 자동 전환됩니다.

## Supabase 설정

1. 새 Supabase 프로젝트에서 **Authentication → Providers → Anonymous Sign-Ins**를 활성화합니다.
2. SQL Editor 또는 Supabase CLI로 마이그레이션을 적용합니다.

```bash
supabase db push
```

마이그레이션 파일: `supabase/migrations/0001_initial_schema.sql`

이 마이그레이션은 다음을 포함합니다.

- 수업/팀/학생/배역/작품/variant/컷/시나리오
- 무대 layout/item, 음악 후보/투표, 촬영/더빙, 최종 영상/제출
- `join_team`, `save_stage_items` security-definer RPC
- 팀원 범위 RLS 정책
- Realtime publication
- `recordings`, `dubbings`, `music`, `final-videos` Storage bucket과 정책

3. `.env.local`에 URL, anon key, service role key를 넣고 seed를 실행합니다.

```bash
pnpm seed:check
pnpm seed:supabase
```

`seed:supabase`는 6작품, 18개 variant, 모든 등장인물/컷 템플릿, 42개 stage asset 슬롯, 샘플 수업 1개, 샘플 모둠 3개와 학생을 upsert합니다.

배포 순서는 `마이그레이션 → seed → Vercel 환경변수 등록 → 배포`입니다. 마이그레이션과 seed는 빌드 과정에서 자동 실행하지 않으므로 Supabase 프로젝트에 한 번 직접 적용해야 합니다. `service_role` 키는 seed와 인증된 교사 서버 API에서만 사용되며 브라우저로 전달되지 않습니다.

## 주요 라우트

| 경로 | 용도 |
| --- | --- |
| `/` | 소개/작품 컬렉션 |
| `/student` | 모둠 코드 입장 |
| `/student/[teamId]` | 7단계 학생 제작 스튜디오 |
| `/worksheet/[workId]/[4|5|6]` | 인쇄용 활동지 |
| `/teacher` | 관리자 코드 로그인/운영 대시보드 |
| `/teacher/gallery` | 제출작 연속 상영 |
| `/api/teacher/session` | HttpOnly 교사 세션 |
| `/api/teacher/dashboard` | 인증된 교사용 DB 현황/수업/모둠 API |
| `/api/render` | 선택형 외부 렌더 워커 접점 |

## 폴더 구조

```text
src/
  app/                         # App Router 페이지와 API
  components/
    student/                   # 7단계 제작 스튜디오
    teacher/                   # 대시보드와 작품관
    worksheet/                 # 인쇄 UI
  hooks/use-stage-realtime.ts  # Realtime Presence/Broadcast + 저장
  lib/
    assets/manifest.ts         # PNG/WebP 교체 가능한 asset manifest
    supabase/                  # SSR/client/storage/repository
    video/compose.ts           # ffmpeg.wasm 자동 MP4 합성
    seed.ts                    # 6작품 교육용 seed 원본
    types.ts                   # 도메인 타입
  store/studio-store.ts        # 데모/낙관적 UI 상태
supabase/migrations/           # schema, RLS, RPC, Storage, Realtime
scripts/                       # seed 검증/업로드
public/assets/                 # 실제 미술 에셋 슬롯
```

## 에셋 교체

`src/lib/assets/manifest.ts`에서 에셋의 `filePath`, 실제 크기, 기본 배율, 방향, 회전, 작품과 태그를 관리합니다. 실제 PNG/WebP를 `public/assets/classics/{workId}/...`에 넣으면 편집기 로직을 바꾸지 않고 교체할 수 있습니다. 에셋이 없는 초기 상태에서는 `placeholderColor` 카드가 촬영 동선 표식으로 동작합니다.

## 영상 합성 방식

`작품 완성하기`를 누를 때만 ffmpeg.wasm을 동적 로드합니다.

1. Canvas로 1280×720 오프닝/CAST/크레딧 카드 생성
2. 각 WebM 컷을 720p H.264/AAC로 정규화
3. 후시녹음이 있으면 해당 컷 오디오로 교체
4. 컷을 순서대로 concat
5. 업로드형 BGM을 16% 기본 음량으로 믹스
6. MP4 생성 후 `final-videos` Storage 업로드

Suno 공유 링크는 재생/투표 후보로 사용할 수 있지만, 브라우저 CORS와 원본 파일 접근 제한 때문에 자동 합성에 넣으려면 음원 파일도 업로드해야 합니다. 저사양 태블릿이나 학교망에서 wasm CDN 사용이 어려우면 `/api/render`에 연결된 서버 FFmpeg/Edge Function 워커로 동일한 manifest를 넘길 수 있습니다.

## 검증

```bash
pnpm typecheck
pnpm lint
pnpm seed:check
pnpm build
```

카메라와 마이크는 브라우저 보안 정책상 HTTPS 또는 localhost에서만 동작합니다. 실제 수업 전에는 사용할 태블릿에서 카메라/마이크 권한, Storage 업로드 제한, 한 팀의 최장 컷 길이를 확인하세요.
