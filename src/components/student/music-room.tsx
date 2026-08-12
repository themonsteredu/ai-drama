"use client";

import { useMemo, useState } from "react";
import { Check, Headphones, Link2, Music2, Upload, Vote } from "lucide-react";
import { getWork } from "@/lib/seed";
import { uploadMedia } from "@/lib/supabase/storage";
import type { MusicCandidate, Team } from "@/lib/types";

interface MusicRoomProps {
  team: Team;
  studentId: string;
  addCandidate: (candidate: MusicCandidate) => void;
  vote: (candidateId: string) => void;
  selectMusic: (candidateId: string) => void;
  setBgmVolume: (volume: number) => void;
  onNext: () => void;
}

export function MusicRoom({ team, studentId, addCandidate, vote, selectMusic, setBgmVolume, onNext }: MusicRoomProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [mood, setMood] = useState("");
  const [uploading, setUploading] = useState(false);
  const work = getWork(team.workId);
  const ownCandidate = team.musicCandidates.find((candidate) => candidate.studentId === studentId);
  const votedId = team.musicCandidates.find((candidate) => candidate.votes.includes(studentId))?.id;
  const ordered = useMemo(() => [...team.musicCandidates].sort((a, b) => a.id.localeCompare(b.id)), [team.musicCandidates]);
  const winner = [...team.musicCandidates].sort((a, b) => b.votes.length - a.votes.length)[0];
  const hasVotes = team.musicCandidates.some((candidate) => candidate.votes.length > 0);
  const hasMultipleCandidates = team.musicCandidates.length > 1;
  const isDemoTeam = ["MOON24", "WAVE55", "STAR66"].includes(team.code);

  async function handleFile(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const publicUrl = await uploadMedia("music", `${team.id}/${studentId}/${Date.now()}-${file.name}`, file);
      addCandidate({ id: ownCandidate?.id ?? crypto.randomUUID(), teamId: team.id, studentId, title: title || file.name.replace(/\.[^.]+$/, ""), source: "upload", url: publicUrl, mood: mood || work?.bgmKeywords.join(", ") || "", votes: ownCandidate?.votes ?? [] });
    } finally { setUploading(false); }
  }

  function submitLink() {
    if (!url.trim()) return;
    addCandidate({ id: ownCandidate?.id ?? crypto.randomUUID(), teamId: team.id, studentId, title: title || "Suno 음악 후보", source: "link", url: url.trim(), mood: mood || work?.bgmKeywords.join(", ") || "", votes: ownCandidate?.votes ?? [] });
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">STEP 5 · 배경음악 등록</p><h2 className="display-serif mt-2 text-4xl font-bold">모둠에서 한 곡이면 충분해요</h2><p className="mt-2 text-[var(--muted)]">Suno 음악 한 곡만 링크 또는 파일로 등록하면 바로 촬영으로 넘어갈 수 있습니다. 비교하고 싶을 때만 후보를 더 올리세요.</p></div><span className="badge"><Music2 size={14}/>{team.musicCandidates.length}곡 등록</span></div>
      <div className="mt-6 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <div className="paper-card rounded-[26px] p-6">
          <h3 className="text-lg font-extrabold">모둠 BGM 한 곡 등록</h3><div className="mt-4 rounded-2xl bg-[rgba(47,105,107,.08)] p-4"><small className="font-bold text-[var(--teal)]">한 곡 등록 즉시 최종 BGM으로 선택됩니다</small><p className="mt-2 text-sm leading-6">추천 키워드 · {work?.bgmKeywords.join(" · ")}</p></div>
          <label className="mt-5 block text-sm font-bold">후보 제목<input className="input mt-2" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 닫힌 대문 앞의 긴장"/></label>
          <label className="mt-4 block text-sm font-bold">음악 분위기<input className="input mt-2" value={mood} onChange={(event) => setMood(event.target.value)} placeholder="긴장, 국악 타악, 따뜻한 마무리"/></label>
          <label className="mt-4 block text-sm font-bold">Suno 공유 링크<div className="mt-2 flex gap-2"><input className="input" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://suno.com/song/..."/><button type="button" onClick={submitLink} className="btn btn-secondary shrink-0"><Link2 size={17}/> 등록</button></div></label>
          <div className="my-5 flex items-center gap-3 text-xs text-[var(--muted)]"><i className="h-px flex-1 bg-black/10"/>또는 파일 업로드<i className="h-px flex-1 bg-black/10"/></div>
          <label className="btn btn-primary w-full cursor-pointer"><Upload size={17}/>{uploading ? "업로드 중…" : "MP3/WAV 파일 선택"}<input className="sr-only" type="file" accept="audio/*" disabled={uploading} onChange={(event) => void handleFile(event.target.files?.[0])}/></label>
          {ownCandidate ? <p className="mt-4 flex items-center gap-2 text-sm font-bold text-[var(--teal)]"><Check size={17}/> “{ownCandidate.title}” 등록·선택 완료</p> : null}
        </div>

        <div>
          <div className="grid gap-3 sm:grid-cols-2">{ordered.map((candidate, index) => { const label = hasMultipleCandidates ? `후보 ${String.fromCharCode(65 + index)}` : "우리 모둠 BGM"; const voted = votedId === candidate.id; const selected = team.selectedMusicId === candidate.id; return <article key={candidate.id} className={`rounded-[24px] border p-5 ${selected ? "border-[var(--teal)] bg-white shadow-lg" : "border-[var(--line)] bg-white/60"}`}><div className="flex items-start justify-between"><div><span className="eyebrow">{selected ? "FINAL TRACK" : "OPTIONAL TRACK"}</span><h3 className="mt-1 text-xl font-extrabold">{label}</h3></div>{selected ? <span className="grid size-7 place-items-center rounded-full bg-[var(--teal)] text-white"><Check size={15}/></span> : <Headphones size={20} className="text-[var(--muted)]"/>}</div><p className="mt-3 text-sm text-[var(--muted)]">{candidate.mood || "분위기 키워드 미입력"}</p>{candidate.source === "upload" ? <audio className="mt-4 w-full" controls src={candidate.url}/> : <a href={candidate.url} target="_blank" rel="noreferrer" className="btn btn-secondary mt-4 min-h-10 w-full text-sm"><Link2 size={15}/> 음악 열기</a>}<button className={`btn mt-3 min-h-10 w-full text-sm ${selected ? "btn-teal" : "btn-secondary"}`} onClick={() => selectMusic(candidate.id)}>{selected ? <><Check size={15}/> 최종 BGM 선택됨</> : "이 곡을 최종 BGM으로"}</button>{hasMultipleCandidates ? <button className={`btn mt-2 min-h-9 w-full text-xs ${voted ? "btn-teal" : "btn-secondary"}`} onClick={() => vote(candidate.id)}><Vote size={14}/>{voted ? `투표 완료 · ${candidate.votes.length}표` : `선택 투표 · ${candidate.votes.length}표`}</button> : null}</article>; })}</div>
          {!team.musicCandidates.length ? <div className="rounded-2xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">한 사람만 대표로 음악 한 곡을 등록해도 됩니다.</div> : null}
          {hasMultipleCandidates && hasVotes && winner ? <div className="mt-4 rounded-2xl bg-[var(--wine)] p-5 text-white"><div className="flex flex-wrap items-center justify-between gap-3"><div><small className="font-bold text-white/60">현재 최다 득표 · 선택 참고용</small><p className="mt-1 text-xl font-extrabold">후보 {String.fromCharCode(65 + ordered.findIndex((item) => item.id === winner.id))} · {winner.votes.length}표</p></div><button className="btn bg-white text-[var(--wine)]" onClick={() => selectMusic(winner.id)}>{team.selectedMusicId === winner.id ? <><Check size={17}/> 최종 BGM</> : "이 곡으로 확정"}</button></div></div> : null}
        </div>
      </div>

      <section className="mt-6 rounded-3xl border border-[var(--line)] bg-white/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">FINAL MIX</p><h3 className="mt-1 text-lg font-extrabold">최종 영상 BGM 음량</h3><p className="mt-1 text-sm text-[var(--muted)]">학생 목소리가 묻히지 않도록 대사 중심으로 조절하세요.</p></div><strong className="rounded-full bg-[var(--wine)] px-4 py-2 text-white">{Math.round((team.bgmVolume ?? .16) * 100)}%</strong></div>
        <input className="mt-5 w-full accent-[var(--wine)]" type="range" min="0.04" max="0.4" step="0.01" value={team.bgmVolume ?? .16} onChange={(event) => setBgmVolume(Number(event.target.value))} aria-label="최종 영상 배경음악 음량"/>
        <div className="mt-2 flex justify-between text-[10px] font-bold text-[var(--muted)]"><span>4% · 대사 중심</span><span>16% · 권장</span><span>40% · 음악 강조</span></div>
      </section>

      <div className="mt-7 flex flex-wrap items-center justify-end gap-3">{isDemoTeam && !team.selectedMusicId ? <span className="text-sm font-bold text-[var(--muted)]">샘플 모둠은 음악 없이 다음 화면을 미리 볼 수 있어요.</span> : null}<button className="btn btn-primary" disabled={!team.selectedMusicId && !isDemoTeam} onClick={onNext}>{team.selectedMusicId ? "컷별 촬영 시작" : "음악 없이 촬영 미리보기"}</button></div>
    </section>
  );
}
