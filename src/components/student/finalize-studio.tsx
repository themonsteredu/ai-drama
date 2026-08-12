"use client";

import { useState } from "react";
import { Check, Clapperboard, Download, Film, LoaderCircle, Send, Sparkles } from "lucide-react";
import { getVariant, getWork } from "@/lib/seed";
import { uploadMedia } from "@/lib/supabase/storage";
import { composeFinalVideo, type ComposeProgress } from "@/lib/video/compose";
import type { Classroom, Team } from "@/lib/types";

export function FinalizeStudio({ team, classroom, setFinalVideo, submitTeam }: { team: Team; classroom: Classroom; setFinalVideo: (url: string) => void; submitTeam: () => void }) {
  const [progress, setProgress] = useState<ComposeProgress>({ percent: 0, message: "준비 완료" });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const work = getWork(team.workId);
  const variant = team.workId ? getVariant(team.workId, team.size) : undefined;
  const selectedMusic = team.musicCandidates.find((candidate) => candidate.id === team.selectedMusicId);
  const allCharacters = [...(variant?.characters ?? []), ...(team.customCharacters ?? [])];
  const ready = team.recordings.filter((recording) => recording.status === "confirmed").length === team.size;

  async function compose() {
    setWorking(true); setError("");
    try {
      const blob = await composeFinalVideo(team, { schoolName: classroom.schoolName, name: classroom.name }, setProgress);
      const url = await uploadMedia("final-videos", `${classroom.id}/${team.id}/final-${crypto.randomUUID()}.mp4`, blob);
      setFinalVideo(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "영상 합성 중 문제가 발생했습니다."); }
    finally { setWorking(false); }
  }

  const assembly = ["오프닝 · 학교/수업/작품/팀", `등장인물 소개 · ${team.size}명`, ...team.scripts.map((cut) => `컷 ${cut.order} · ${cut.title} · 화자 이름표`), "엔딩 크레딧 · CAST & CREW"];
  return (
    <section>
      <div><p className="eyebrow">STEP 7 · 자동 작품 완성</p><h2 className="display-serif mt-2 text-4xl font-bold">편집은 시스템에게, 무대는 우리에게</h2><p className="mt-2 text-[var(--muted)]">확정한 컷에 화자 이름표를 넣고, 선택한 음악·오프닝·등장인물 소개·크레딧을 자동 합성합니다.</p></div>
      <div className="mt-7 grid gap-5 lg:grid-cols-[.78fr_1.22fr]">
        <aside className="paper-card rounded-[28px] p-6">
          <p className="eyebrow">ASSEMBLY ORDER</p><h3 className="mt-2 text-2xl font-extrabold">자동 편집 순서</h3>
          <ol className="mt-5 space-y-3">{assembly.map((label, index) => <li key={`${label}-${index}`} className="flex items-center gap-3 rounded-2xl bg-black/[.035] p-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-xs font-black shadow">{index + 1}</span><span className="text-sm font-semibold">{label}</span></li>)}</ol>
          <div className="mt-5 rounded-2xl bg-[rgba(47,105,107,.09)] p-4 text-sm"><strong className="text-[var(--teal)]">배경음악</strong><p className="mt-1">{selectedMusic?.title ?? "최종 음악 미선택"}</p><small className="mt-2 block leading-5 text-[var(--muted)]">설정한 {Math.round((team.bgmVolume ?? .16) * 100)}% 음량으로 반복 재생하며 학생 대사와 자동 믹싱합니다.</small></div>
        </aside>

        <div className="theatre-curtain overflow-hidden rounded-[32px] p-6 text-white md:p-9">
          <div className="flex items-center justify-between"><span className="badge bg-white/10 text-white"><Film size={14}/>{work?.title}</span><span className="text-xs font-bold text-white/50">1280 × 720 · MP4</span></div>
          {team.finalVideoUrl ? (
            <div className="mt-6"><video className="aspect-video w-full rounded-2xl bg-black object-contain shadow-2xl" controls src={team.finalVideoUrl}/><div className="mt-5 flex flex-wrap gap-3"><a className="btn bg-white text-[var(--wine)]" href={team.finalVideoUrl} download={`${team.name}-${work?.title}.mp4`}><Download size={17}/> MP4 내려받기</a><button className="btn btn-teal" disabled={team.phase === "submitted"} onClick={submitTeam}>{team.phase === "submitted" ? <><Check size={17}/> 제출 완료</> : <><Send size={17}/> 교사용 작품관에 제출</>}</button></div></div>
          ) : (
            <div className="mt-10 text-center"><span className="mx-auto grid size-24 place-items-center rounded-full bg-white/10"><Clapperboard size={43} className="text-[var(--gold)]"/></span><h3 className="display-serif mt-6 text-4xl font-bold">{team.name}의 {work?.title}</h3><p className="mt-3 text-white/60">{team.students.map((student) => allCharacters.find((character) => character.id === student.characterId)?.name).filter(Boolean).join(" · ")}</p><div className="mx-auto mt-8 max-w-lg"><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[var(--gold)] transition-all duration-500" style={{ width: `${progress.percent}%` }}/></div><p className="mt-3 text-sm font-semibold text-white/70">{progress.message}</p></div><button className="btn mt-8 bg-white text-[var(--wine)]" disabled={!ready || working} onClick={() => void compose()}>{working ? <><LoaderCircle className="animate-spin" size={18}/> 자동 합성 중 {progress.percent}%</> : <><Sparkles size={18}/> 작품 완성하기</>}</button>{!ready ? <p className="mt-3 text-xs text-white/50">모든 컷을 확정하면 버튼이 열립니다.</p> : null}{error ? <p role="alert" className="mx-auto mt-5 max-w-xl rounded-2xl bg-red-500/15 p-4 text-sm text-red-100">{error}<span className="mt-2 block text-xs text-red-100/65">학교 네트워크에서 ffmpeg.wasm CDN이 차단된 경우 서버 렌더 워커를 연결할 수 있습니다.</span></p> : null}</div>
          )}
        </div>
      </div>
    </section>
  );
}
