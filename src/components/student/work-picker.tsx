"use client";

import { BookOpenCheck, Check, Users } from "lucide-react";
import { CLASSIC_WORKS } from "@/lib/seed";
import type { Team, WorkId } from "@/lib/types";

export function WorkPicker({ team, onSelect, onNext }: { team: Team; onSelect: (workId: WorkId) => void; onNext: () => void }) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">STEP 1 · 작품 선택</p><h2 className="display-serif mt-2 text-4xl font-bold">우리 팀이 다시 만들 장면</h2><p className="mt-2 text-[var(--muted)]">{team.size}명이므로 등장인물 {team.size}명 · 촬영 컷 {team.size}개가 자동 준비됩니다.</p></div>
        <div className="flex gap-2"><span className="badge"><BookOpenCheck size={14}/>{CLASSIC_WORKS.length}개 작품 준비</span><span className="badge"><Users size={14}/>{team.size}인 버전</span></div>
      </div>
      <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CLASSIC_WORKS.map((work) => { const selected = team.workId === work.id; return <button key={work.id} type="button" onClick={() => onSelect(work.id)} className={`focus-ring relative overflow-hidden rounded-[26px] border p-6 text-left transition hover:-translate-y-1 hover:shadow-lg ${selected ? "border-[var(--wine)] bg-white shadow-lg" : "border-[var(--line)] bg-white/55"}`}><div className="absolute right-0 top-0 h-28 w-28 rounded-bl-full opacity-15" style={{ background: work.color }}/>{selected ? <span className="absolute right-5 top-5 grid size-7 place-items-center rounded-full bg-[var(--wine)] text-white"><Check size={16}/></span> : null}<span className="text-xs font-black tracking-[.15em]" style={{ color: work.color }}>HIGHLIGHT SCENE</span><h3 className="display-serif mt-4 text-3xl font-bold">{work.title}</h3><p className="mt-2 font-bold">{work.highlightTitle}</p><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{work.sceneContext}</p><div className="mt-5 flex flex-wrap gap-1.5">{work.emotions.slice(0, 3).map((emotion) => <span key={emotion} className="rounded-full bg-black/5 px-2 py-1 text-xs font-semibold">#{emotion}</span>)}</div></button>; })}
      </div>
      <div className="mt-7 flex justify-end"><button className="btn btn-primary" disabled={!team.workId} onClick={onNext}>이 작품으로 역할 배정</button></div>
    </section>
  );
}
