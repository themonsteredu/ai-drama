"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Maximize, Play, SkipForward } from "lucide-react";
import { getWork } from "@/lib/seed";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useStudioStore } from "@/store/studio-store";

export function GalleryPlaylist() {
  const teams = useStudioStore((state) => state.classroom.teams);
  const replaceClassroom = useStudioStore((state) => state.replaceClassroom);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void fetch("/api/teacher/dashboard").then(async (response) => {
      const body = await response.json() as { classroom?: Parameters<typeof replaceClassroom>[0] };
      if (response.ok && body.classroom) replaceClassroom(body.classroom);
    });
  },[replaceClassroom]);
  const queue = useMemo(() => teams.filter((team) => team.phase === "submitted" && team.finalVideoUrl),[teams]);
  const [index,setIndex] = useState(0); const videoRef = useRef<HTMLVideoElement>(null); const current = queue[index];
  function next() { if (!queue.length) return; setIndex((value) => (value + 1) % queue.length); setTimeout(() => void videoRef.current?.play(),50); }
  if (!current) return <main className="theatre-curtain grid min-h-screen place-items-center p-6 text-white"><section className="max-w-lg text-center"><span className="mx-auto grid size-20 place-items-center rounded-full bg-white/10"><Play size={34}/></span><h1 className="display-serif mt-6 text-4xl font-bold">상영을 기다리는 무대</h1><p className="mt-3 leading-7 text-white/60">제출 완료된 영상이 생기면 팀 순서대로 자동 재생됩니다.</p><Link className="btn mt-7 bg-white text-[var(--wine)]" href="/teacher"><ArrowLeft size={17}/> 대시보드로</Link></section></main>;
  const work = getWork(current.workId);
  return <main className="theatre-curtain min-h-screen p-4 text-white md:p-7"><div className="mx-auto max-w-[1500px]"><header className="flex flex-wrap items-center justify-between gap-4"><Link className="btn bg-white/10 text-white" href="/teacher"><ArrowLeft size={17}/> 작품관 나가기</Link><div className="text-center"><p className="text-xs font-bold tracking-[.2em] text-white/50">CLASS SCREENING</p><h1 className="display-serif mt-1 text-2xl font-bold">전체 작품 상영</h1></div><button className="btn bg-white/10 text-white" onClick={() => document.documentElement.requestFullscreen()}><Maximize size={17}/> 전체 화면</button></header><div className="mt-6 grid gap-5 lg:grid-cols-[1fr_280px]"><section><video key={current.id} ref={videoRef} className="aspect-video w-full rounded-[24px] bg-black object-contain shadow-2xl" controls autoPlay src={current.finalVideoUrl} onEnded={next}/><div className="mt-5 flex items-center justify-between gap-4"><div><span className="text-sm font-bold text-[var(--gold)]">NOW PLAYING · {index + 1}/{queue.length}</span><h2 className="display-serif mt-1 text-3xl font-bold">{current.name} · {work?.title}</h2></div><button className="btn bg-white text-[var(--wine)]" onClick={next}><SkipForward size={18}/> 다음 작품</button></div></section><aside className="rounded-[24px] bg-white/8 p-4"><h3 className="font-extrabold">오늘의 상영 순서</h3><div className="mt-4 space-y-2">{queue.map((team,queueIndex) => <button key={team.id} onClick={() => setIndex(queueIndex)} className={`w-full rounded-2xl p-3 text-left ${queueIndex === index ? "bg-white text-[var(--wine)]" : "bg-white/5 text-white hover:bg-white/10"}`}><span className="text-[10px] font-black opacity-60">FILM {String(queueIndex + 1).padStart(2,"0")}</span><strong className="mt-1 block">{team.name}</strong><small className="opacity-60">{getWork(team.workId)?.title}</small></button>)}</div></aside></div></div></main>;
}
