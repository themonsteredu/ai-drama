# Stage asset slots

실제 PNG/WebP 아트 에셋을 `src/lib/assets/manifest.ts`의 `filePath`와 같은 경로에 넣습니다.

```text
classics/{workId}/backgrounds/
classics/{workId}/buildings/
classics/{workId}/characters/
classics/{workId}/props/
classics/{workId}/animals/
classics/{workId}/nature/
classics/{workId}/effects/
shared/effects/
shared/props/
```

화면은 파일이 들어오기 전에도 manifest의 크기·기본 배율·방향·태그와 placeholderColor로 동작합니다.
