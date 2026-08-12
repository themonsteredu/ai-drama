"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpenCheck, CheckCircle2, ChevronRight, ClipboardList, Copy, Film, LoaderCircle, MonitorPlay, Plus, RotateCcw, Users } from "lucide-react";
import { getWork } from "@/lib/seed";
import type { TeamPhase, TeamSize } from "@/lib/types";
import { useStudioStore } from "@/store/studio-store";

const phaseLabels: Record<TeamPhase, string> = { "work-selection": "작품 선택 전", "role-assignment": "역할 배정중", script: "시나리오 작성중", stage: "무대꾸미기중", music: "음악 등록중", recording: "촬영중", rendering: "영상생성중", submitted: "제출완료" };
const phaseProgress: Record<TeamPhase, number> = { "work-selection": 5, "role-assignment": 18, script: 32, stage: 48, music: 64, recording: 78, rendering: 92, submitted: 100 };

export function TeacherDashboard() {
  const store = useStudioStore();
  const classroom = store.classroom;
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [size, setSize] = useState<TeamSize>(4);
  const [createMessage, setCreateMessage] = useState("");
  const [createError, setCreateError] = useState("");
  const submitted = classroom.teams.filter((team) => team.phase === "submitted").length;

  async function submitTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teamName.trim() || creating) return;
    setCreating(true); setCreateError(""); setCreateMessage("");
    const result = await store.createTeam(teamName.trim(), size);
    setCreating(false);
    if (!result.ok) { setCreateError(result.message); return; }
    setCreateMessage(result.message); setTeamName(""); setAdding(false);
  }

  return (
    <main className="shell py-9 md:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">TEACHER DASHBOARD</p>
          {editing ? <div className="mt-3 grid max-w-2xl gap-2 sm:grid-cols-3"><input className="input" value={classroom.schoolName} onChange={(event) => store.updateClassroom({ schoolName: event.target.value })}/><input className="input" value={classroom.name} onChange={(event) => store.updateClassroom({ name: event.target.value })}/><input className="input" value={classroom.teacherName} onChange={(event) => store.updateClassroom({ teacherName: event.target.value })}/></div> : <><h1 className="display-serif mt-2 text-4xl font-bold md:text-5xl">{classroom.name}</h1><p className="mt-2 text-[var(--muted)]">{classroom.schoolName} · 담당 {classroom.teacherName}</p></>}
        </div>
        <div className="flex flex-wrap gap-2"><button className="btn btn-secondary" onClick={() => setEditing(!editing)}>{editing ? "수업 정보 저장" : "수업 정보 수정"}</button><button className="btn btn-primary" onClick={() => { setAdding(!adding); setCreateError(""); }}><Plus size={17}/> 모둠 코드 생성</button></div>
      </div>

      {adding ? (
        <form onSubmit={(event) => void submitTeam(event)} className="paper-card mt-6 rounded-[24px] p-5">
          <div className="flex flex-wrap items-end gap-3"><label className="min-w-56 flex-1 text-sm font-bold">모둠명<input className="input mt-2" value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="예: 청춘극단" required/></label><label className="text-sm font-bold">인원 수<select className="input mt-2 min-w-28" value={size} onChange={(event) => setSize(Number(event.target.value) as TeamSize)}><option value={4}>4명</option><option value={5}>5명</option><option value={6}>6명</option></select></label><button className="btn btn-primary min-w-40" disabled={creating}>{creating ? <><LoaderCircle className="animate-spin" size={17}/> 생성 중</> : `코드 만들기 · ${size}명`}</button></div>
          <p className="mt-3 text-xs text-[var(--muted)]">서버에서 중복되지 않는 코드를 확정한 뒤 목록에 표시합니다. 표시된 코드만 학생에게 안내하세요.</p>
          {createError ? <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{createError}</p> : null}
        </form>
      ) : null}
      {createMessage ? <p role="status" className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-extrabold text-emerald-800"><CheckCircle2 size={18}/>{createMessage}</p> : null}

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[["전체 모둠", classroom.teams.length, Users], ["시나리오 완료", classroom.teams.filter((team) => phaseProgress[team.phase] > 32).length, ClipboardList], ["촬영 진행", classroom.teams.filter((team) => ["recording", "rendering", "submitted"].includes(team.phase)).length, Film], ["제출 완료", submitted, BookOpenCheck]].map(([label, value, Icon]) => { const IconComponent = Icon as typeof Users; return <article key={String(label)} className="paper-card rounded-[24px] p-5"><div className="flex items-center justify-between"><span className="text-sm font-bold text-[var(--muted)]">{String(label)}</span><IconComponent size={18} className="text-[var(--wine)]"/></div><strong className="display-serif mt-4 block text-4xl">{String(value)}</strong></article>; })}
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between"><div><p className="eyebrow">TEAM PROGRESS</p><h2 className="mt-1 text-2xl font-extrabold">모둠별 제작 현황</h2></div><Link href="/teacher/gallery" className="btn btn-teal"><MonitorPlay size={17}/> 전체 작품 상영</Link></div>
        <div className="mt-5 space-y-4">
          {classroom.teams.map((team) => {
            const work = getWork(team.workId);
            const confirmed = team.recordings.filter((recording) => recording.status === "confirmed").length;
            return (
              <article key={team.id} className="paper-card rounded-[26px] p-5 md:p-6">
                <div className="grid items-center gap-5 lg:grid-cols-[1.1fr_.8fr_1fr_auto]">
                  <div className="flex items-center gap-4"><span className="grid size-13 shrink-0 place-items-center rounded-2xl text-lg font-black text-white" style={{ background: work?.color ?? "var(--muted)" }}>{team.name.slice(0, 1)}</span><div><h3 className="text-lg font-extrabold">{team.name}</h3><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]"><button type="button" className="badge" onClick={() => void navigator.clipboard?.writeText(team.code)}><Copy size={12}/>{team.code}</button><span>{team.students.length}/{team.size}명</span><span>·</span><span>{work?.title ?? "작품 미선택"}</span></div></div></div>
                  <div><div className="flex justify-between text-xs font-bold"><span>{phaseLabels[team.phase]}</span><span>{phaseProgress[team.phase]}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-black/5"><div className="h-full rounded-full bg-[var(--wine)]" style={{ width: `${phaseProgress[team.phase]}%` }}/></div></div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-black/[.035] p-2"><strong className="block text-base">{team.scripts.filter((cut) => cut.confirmed).length}/{team.size}</strong>시나리오</div><div className="rounded-xl bg-black/[.035] p-2"><strong className="block text-base">{team.stageConfirmed.length}/{team.size}</strong>무대</div><div className="rounded-xl bg-black/[.035] p-2"><strong className="block text-base">{confirmed}/{team.size}</strong>촬영</div></div>
                  <details className="relative"><summary className="btn btn-secondary min-h-10 cursor-pointer list-none px-3 text-sm">상세 <ChevronRight size={15}/></summary><div className="absolute right-0 top-12 z-20 w-[min(440px,80vw)] rounded-2xl border border-[var(--line)] bg-white p-5 shadow-2xl"><h4 className="font-extrabold">{team.name} 시나리오</h4><div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{team.scripts.map((cut) => <div key={cut.id} className="rounded-xl bg-black/[.035] p-3"><strong className="text-sm">컷 {cut.order}. {cut.title}</strong><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{cut.summary}</p></div>)}</div>{team.finalVideoUrl ? <video className="mt-4 aspect-video w-full rounded-xl bg-black" controls src={team.finalVideoUrl}/> : null}</div></details>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <div className="mt-10 flex justify-center"><button className="btn btn-secondary text-xs" onClick={() => { if (confirm("브라우저 데모 데이터를 초기 상태로 되돌릴까요?")) store.resetDemo(); }}><RotateCcw size={14}/> 데모 데이터 초기화</button></div>
    </main>
  );
}
