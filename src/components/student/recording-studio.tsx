"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Mic, RotateCcw, Square, UserRound, Video } from "lucide-react";
import { getVariant } from "@/lib/seed";
import { uploadMedia } from "@/lib/supabase/storage";
import type { CutRecording, RecordingStatus, SpeakerCue, Team } from "@/lib/types";

function statusLabel(status: RecordingStatus) {
  return { "not-recorded": "미촬영", recorded: "촬영완료", retake: "다시촬영 필요", confirmed: "확정" }[status];
}

async function mediaDuration(blob: Blob, kind: "video" | "audio") {
  const url = URL.createObjectURL(blob);
  try {
    const media = document.createElement(kind);
    media.preload = "metadata";
    media.src = url;
    return await new Promise<number | undefined>((resolve) => {
      media.onloadedmetadata = () => resolve(Number.isFinite(media.duration) ? media.duration : undefined);
      media.onerror = () => resolve(undefined);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function RecordingStudio({ team, updateRecording, onNext }: { team: Team; updateRecording: (recording: CutRecording) => void; onNext: () => void }) {
  const [activeCutId, setActiveCutId] = useState(team.scripts[0]?.id ?? "");
  const [mode, setMode] = useState<"video" | "dubbing">("video");
  const [preparedMode, setPreparedMode] = useState<"video" | "dubbing" | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [speakerCues, setSpeakerCues] = useState<SpeakerCue[]>([]);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string>();
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const speakerCuesRef = useRef<SpeakerCue[]>([]);

  const current = team.recordings.find((item) => item.cutId === activeCutId) ?? { cutId: activeCutId, status: "not-recorded" as const };
  const activeScript = team.scripts.find((cut) => cut.id === activeCutId);
  const variant = team.workId ? getVariant(team.workId, team.size) : undefined;
  const characters = useMemo(() => [...(variant?.characters ?? []), ...(team.customCharacters ?? [])], [variant, team.customCharacters]);
  const cast = useMemo(() => team.students.flatMap((student) => {
    const character = characters.find((item) => item.id === student.characterId);
    return character ? [{ characterId: character.id, characterName: character.name, studentName: student.name }] : [];
  }), [characters, team.students]);
  const activeSpeaker = cast.find((item) => item.characterId === activeSpeakerId);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  function chooseCut(cutId: string) {
    if (recording) return;
    setActiveCutId(cutId);
    const saved = team.recordings.find((item) => item.cutId === cutId)?.speakerCues ?? [];
    setSpeakerCues(saved); speakerCuesRef.current = saved; setActiveSpeakerId(undefined);
  }

  async function prepare(nextMode: "video" | "dubbing") {
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia(nextMode === "video"
        ? { video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: { echoCancellation: true, noiseSuppression: true } }
        : { audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream; setMode(nextMode); setPreparedMode(nextMode); setError("");
      if (previewRef.current && nextMode === "video") { previewRef.current.srcObject = stream; await previewRef.current.play(); }
    } catch { setError("카메라와 마이크 권한을 허용해 주세요. HTTPS 또는 localhost에서 사용할 수 있습니다."); }
  }

  function makeCue(characterId: string, atMs: number): SpeakerCue | undefined {
    const speaker = cast.find((item) => item.characterId === characterId);
    if (!speaker) return;
    const matchingLines = activeScript?.dialogueLines.filter((line) => line.speakerCharacterId === characterId) ?? [];
    const usedCount = speakerCuesRef.current.filter((cue) => cue.characterId === characterId).length;
    return { id: crypto.randomUUID(), ...speaker, atMs, text: matchingLines[usedCount]?.text };
  }

  function markSpeaker(characterId: string, eventTime: number) {
    if (!recording || mode !== "video") return;
    const cue = makeCue(characterId, Math.max(0, Math.round(eventTime - recordingStartedAtRef.current)));
    if (!cue) return;
    const next = [...speakerCuesRef.current, cue];
    speakerCuesRef.current = next; setSpeakerCues(next); setActiveSpeakerId(characterId);
  }

  function start(event: React.MouseEvent<HTMLButtonElement>) {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = mode === "video"
      ? (["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type)) ?? "")
      : (["audio/webm;codecs=opus", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type)) ?? "");
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    if (mode === "video") {
      const firstCharacterId = activeScript?.dialogueLines.find((line) => line.speakerCharacterId)?.speakerCharacterId;
      const firstCue = firstCharacterId ? makeCue(firstCharacterId, 0) : undefined;
      speakerCuesRef.current = firstCue ? [firstCue] : [];
      setSpeakerCues(speakerCuesRef.current); setActiveSpeakerId(firstCharacterId);
    }
    recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
    recorder.onstop = () => void saveRecording(new Blob(chunksRef.current, { type: mimeType || (mode === "video" ? "video/webm" : "audio/webm") }));
    recordingStartedAtRef.current = event.timeStamp;
    recorder.start(250); recorderRef.current = recorder; setRecording(true);
  }

  async function saveRecording(blob: Blob) {
    const url = await uploadMedia(mode === "video" ? "recordings" : "dubbings", `${team.id}/${activeCutId}/${crypto.randomUUID()}.webm`, blob);
    const duration = await mediaDuration(blob, mode === "video" ? "video" : "audio");
    updateRecording(mode === "video"
      ? { ...current, videoUrl: url, videoName: `cut-${activeScript?.order}.webm`, duration, speakerCues: speakerCuesRef.current, status: "recorded" }
      : { ...current, dubbingUrl: url });
  }

  function stop() { recorderRef.current?.stop(); setRecording(false); setActiveSpeakerId(undefined); }
  const allConfirmed = team.scripts.every((cut) => team.recordings.find((item) => item.cutId === cut.id)?.status === "confirmed");

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">STEP 6 · 촬영 스테이션</p><h2 className="display-serif mt-2 text-4xl font-bold">한 컷씩 찍고, 화자를 표시하기</h2><p className="mt-2 text-[var(--muted)]">촬영 담당이 대사가 시작될 때 배우 버튼을 누르면 최종 영상에 캐릭터 이름표가 정확한 시점에 붙습니다.</p></div><span className="badge"><Video size={14}/>{team.recordings.filter((item) => item.status === "confirmed").length}/{team.size}컷 확정</span></div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">{team.scripts.map((cut) => { const status = team.recordings.find((item) => item.cutId === cut.id)?.status ?? "not-recorded"; return <button key={cut.id} onClick={() => chooseCut(cut.id)} className={`focus-ring min-w-32 rounded-2xl border p-3 text-left ${activeCutId === cut.id ? "border-[var(--wine)] bg-white shadow-md" : "border-[var(--line)] bg-white/50"}`}><span className="text-xs font-black text-[var(--wine)]">CUT {cut.order}</span><strong className="mt-1 block truncate text-sm">{cut.title}</strong><span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-black ${status === "confirmed" ? "bg-emerald-100 text-emerald-800" : status === "retake" ? "bg-red-100 text-red-700" : "bg-black/5 text-[var(--muted)]"}`}>{statusLabel(status)}</span></button>; })}</div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
        <div className="overflow-hidden rounded-[28px] bg-[#1d1917] p-4">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
            <video ref={previewRef} className={`h-full w-full object-cover ${mode === "dubbing" ? "hidden" : ""}`} muted playsInline/>
            {mode === "dubbing" ? <div className="grid h-full place-items-center text-center text-white"><div><Mic className="mx-auto text-[var(--gold)]" size={54}/><h3 className="mt-4 text-2xl font-extrabold">후시녹음 모드</h3><p className="mt-2 text-sm text-white/60">화면을 보며 대사를 또렷하게 녹음하세요.</p></div></div> : null}
            {recording ? <span className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-xs font-black text-white"><i className="size-2 animate-pulse rounded-full bg-white"/> REC</span> : null}
            {recording && activeSpeaker ? <div className="absolute bottom-5 left-5 rounded-xl border border-white/20 bg-black/75 px-4 py-3 text-white shadow-xl"><p className="text-[10px] font-black tracking-[.16em] text-amber-300">NOW SPEAKING</p><strong className="mt-1 block text-xl">{activeSpeaker.characterName}</strong><span className="text-xs text-white/70">배우 {activeSpeaker.studentName}</span></div> : null}
          </div>

          <div className="mt-4 rounded-2xl bg-white/5 p-3 text-white">
            <p className="text-center text-xs font-bold text-white/65">{recording ? "대사가 시작되는 순간, 말하는 캐릭터를 누르세요" : "촬영 중 아래 버튼이 화자 타임코드를 기록합니다"}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{cast.map((speaker) => <button key={speaker.characterId} type="button" disabled={!recording || mode !== "video"} onClick={(event) => markSpeaker(speaker.characterId, event.timeStamp)} className={`rounded-xl border px-3 py-3 text-left transition ${activeSpeakerId === speaker.characterId ? "border-amber-300 bg-amber-300 text-black" : "border-white/15 bg-white/5 text-white disabled:opacity-45"}`}><span className="flex items-center gap-2 text-sm font-black"><UserRound size={15}/>{speaker.characterName}</span><small className="mt-1 block opacity-70">{speaker.studentName}</small></button>)}</div>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">{preparedMode !== "video" ? <button className="btn btn-secondary" onClick={() => void prepare("video")}><Video size={17}/> 카메라 준비</button> : null}{preparedMode !== "dubbing" ? <button className="btn btn-secondary" onClick={() => void prepare("dubbing")}><Mic size={17}/> 선택 후시녹음</button> : null}{preparedMode && !recording ? <button className="btn btn-primary" onClick={start}><span className="size-3 rounded-full bg-red-400"/> {mode === "video" ? "촬영 시작" : "녹음 시작"}</button> : null}{recording ? <button className="btn bg-red-600 text-white" onClick={stop}><Square size={16} fill="currentColor"/> 정지하고 저장</button> : null}</div>
          {error ? <p role="alert" className="mt-3 text-center text-sm text-red-300">{error}</p> : null}
        </div>

        <aside className="paper-card rounded-[28px] p-6">
          <span className="eyebrow">CUT {activeScript?.order}</span><h3 className="mt-2 text-2xl font-extrabold">{activeScript?.title}</h3><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{activeScript?.summary}</p>
          <div className="mt-5 rounded-2xl bg-[var(--paper-deep)] p-4"><small className="font-black text-[var(--wine)]">대사 순서</small><div className="mt-2 space-y-2">{activeScript?.dialogueLines.map((line) => <p key={line.id} className="text-sm leading-6"><strong>{line.speakerName}</strong> “{line.text}”</p>)}</div></div>
          {speakerCues.length ? <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4"><small className="font-black text-blue-800">기록된 화자 {speakerCues.length}회</small><div className="mt-2 flex flex-wrap gap-1">{speakerCues.map((cue) => <span key={cue.id} className="rounded-full bg-white px-2 py-1 text-[10px] font-bold">{(cue.atMs / 1000).toFixed(1)}초 · {cue.characterName}</span>)}</div></div> : null}
          {current.videoUrl ? <div className="mt-5"><video className="aspect-video w-full rounded-2xl bg-black object-cover" controls src={current.videoUrl}/><div className="mt-3 grid grid-cols-2 gap-2"><button className="btn btn-secondary min-h-10 px-2" onClick={() => updateRecording({ ...current, status: "retake", speakerCues: [] })}><RotateCcw size={15}/> 다시찍기</button><button className="btn btn-teal min-h-10 px-2" onClick={() => updateRecording({ ...current, status: "confirmed" })}><Check size={15}/> 이 컷 확정</button></div>{current.dubbingUrl ? <audio className="mt-3 w-full" controls src={current.dubbingUrl}/> : null}</div> : <div className="mt-5 rounded-2xl border border-dashed border-[var(--line)] p-5 text-center text-sm text-[var(--muted)]">촬영 후 이곳에서 바로 확인합니다.</div>}
        </aside>
      </div>
      <div className="mt-7 flex justify-end"><button className="btn btn-primary" disabled={!allConfirmed} onClick={onNext}>자동으로 작품 완성하기</button></div>
    </section>
  );
}
