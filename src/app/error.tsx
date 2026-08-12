"use client";

import { RotateCcw } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="shell grid min-h-screen place-items-center"><section className="paper-card max-w-xl rounded-[32px] p-10 text-center"><p className="eyebrow">무대 점검 중</p><h1 className="display-serif mt-3 text-4xl font-bold">장면을 불러오지 못했어요.</h1><p className="mt-4 text-[var(--muted)]">저장된 내용은 그대로입니다. 다시 불러와 주세요.</p><button className="btn btn-primary mt-7" onClick={reset}><RotateCcw size={18} /> 다시 불러오기</button></section></main>;
}
