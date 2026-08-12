"use client";

import { useState } from "react";
import { BarChart3, KeyRound, LoaderCircle, MonitorPlay, Users } from "lucide-react";

export function TeacherLogin({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [code, setCode] = useState("STAGE2026");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/teacher/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
    setLoading(false);
    if (!response.ok) {
      const body = await response.json();
      setError(body.error);
      return;
    }
    onAuthenticated();
  }

  return (
    <main className="shell grid min-h-[calc(100vh-72px)] place-items-center py-10">
      <section className="grid w-full max-w-5xl overflow-hidden border border-[var(--line)] bg-white shadow-[0_24px_70px_rgba(16,24,40,.12)] lg:grid-cols-2">
        <div className="studio-grid bg-[#101828] p-8 text-white md:p-10">
          <p className="text-[10px] font-bold tracking-[.2em] text-blue-300">TEACHER PRODUCTION DESK</p>
          <h1 className="display-serif mt-5 text-4xl leading-tight">수업의 모든 무대를<br/>한 화면에서 관리합니다.</h1>
          <p className="mt-5 text-sm leading-7 text-white/60">모둠 코드를 만들고, 지금 어느 단계인지 확인하고, 제출된 작품을 교실 시사회로 바로 상영하세요.</p>
          <div className="mt-10 grid gap-3 text-sm">
            <span className="flex items-center gap-3 border-t border-white/10 pt-4"><Users size={16} className="text-blue-300"/> 모둠별 진행 단계</span>
            <span className="flex items-center gap-3 border-t border-white/10 pt-4"><BarChart3 size={16} className="text-emerald-300"/> 컷 촬영·제출 현황</span>
            <span className="flex items-center gap-3 border-t border-white/10 pt-4"><MonitorPlay size={16} className="text-amber-300"/> 반 전체 연속 상영</span>
          </div>
        </div>
        <form onSubmit={submit} className="p-8 md:p-10 lg:p-12">
          <span className="grid size-11 place-items-center rounded-lg bg-blue-50 text-[var(--wine)]"><KeyRound size={21}/></span>
          <p className="eyebrow mt-7">SECURE ACCESS</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">교사 운영실</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">관리자 코드를 입력해 수업 대시보드를 여세요.</p>
          <label className="mt-8 block text-sm font-bold">관리자 코드<input className="input mt-2" type="password" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="current-password"/></label>
          <button className="btn btn-primary mt-5 w-full" disabled={loading}>{loading ? <LoaderCircle className="animate-spin" size={17}/> : null}운영실 열기</button>
          {error ? <p role="alert" className="mt-4 border border-red-200 bg-red-50 p-3 text-center text-sm font-bold text-red-700">{error}</p> : null}
          <p className="mt-7 border-t border-[var(--line)] pt-5 text-center text-xs text-[var(--muted)]">데모 관리자 코드 · STAGE2026</p>
        </form>
      </section>
    </main>
  );
}
