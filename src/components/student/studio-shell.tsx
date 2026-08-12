"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowLeft, BookOpen, CircleUserRound, Cloud, Users } from "lucide-react";
import { FinalizeStudio } from "@/components/student/finalize-studio";
import { MusicRoom } from "@/components/student/music-room";
import { RecordingStudio } from "@/components/student/recording-studio";
import { RoleAssignment } from "@/components/student/role-assignment";
import { ScriptBoard } from "@/components/student/script-board";
import { StageEditor } from "@/components/student/stage-editor";
import { StepNav, type StudioStep } from "@/components/student/step-nav";
import { WorkPicker } from "@/components/student/work-picker";
import { getWork } from "@/lib/seed";
import type { StageItem, TeamPhase, WorkId } from "@/lib/types";
import { useStudioStore } from "@/store/studio-store";

const phaseStep: Record<TeamPhase, StudioStep> = { "work-selection": "work", "role-assignment": "roles", script: "script", stage: "stage", music: "music", recording: "recording", rendering: "finish", submitted: "finish" };
const stepIndex: Record<StudioStep, number> = { work: 0, roles: 1, script: 2, stage: 3, music: 4, recording: 5, finish: 6 };

export function StudioShell({ teamId }: { teamId: string }) {
  const store = useStudioStore();
  const team = store.classroom.teams.find((item) => item.id === teamId);
  const setTeamStageItems = useCallback((cutId: string, items: StageItem[]) => useStudioStore.getState().setStageItems(teamId, cutId, items), [teamId]);
  const confirmTeamStage = useCallback((cutId: string, confirmed: boolean) => useStudioStore.getState().confirmStage(teamId, cutId, confirmed), [teamId]);
  const initialStep = team ? phaseStep[team.phase] : "work";
  const [step, setStep] = useState<StudioStep>(initialStep);
  if (!team) return <main className="shell grid min-h-screen place-items-center"><section className="paper-card rounded-[28px] p-9 text-center"><h1 className="text-2xl font-extrabold">모둠을 찾을 수 없어요.</h1><Link className="btn btn-primary mt-6" href="/student">다시 입장하기</Link></section></main>;

  const studentId = store.activeStudentId && team.students.some((student) => student.id === store.activeStudentId) ? store.activeStudentId : team.students[0]?.id;
  const activeStudent = team.students.find((student) => student.id === studentId);
  const work = getWork(team.workId);
  const maxIndex = Math.min(6, stepIndex[phaseStep[team.phase]] + (team.phase === "submitted" ? 0 : 1));
  const currentTeamId = team.id;

  function advance(nextStep: StudioStep, phase: TeamPhase) {
    store.setPhase(currentTeamId, phase); setStep(nextStep); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-black/5 bg-[rgba(247,242,233,.9)] backdrop-blur-xl">
        <div className="shell flex min-h-17 items-center justify-between gap-4 py-2"><div className="flex min-w-0 items-center gap-3"><Link className="focus-ring grid size-10 shrink-0 place-items-center rounded-2xl bg-white shadow-sm" href="/student" aria-label="입장 화면"><ArrowLeft size={18}/></Link><div className="min-w-0"><div className="flex items-center gap-2"><strong className="truncate">{team.name}</strong><span className="badge hidden sm:inline-flex"><Users size={12}/>{team.size}명</span></div><p className="truncate text-xs text-[var(--muted)]">{work ? `${work.title} · ${work.highlightTitle}` : "작품을 선택해 주세요"}</p></div></div><div className="flex shrink-0 items-center gap-2"><span className="badge hidden md:inline-flex"><Cloud size={12}/>{process.env.NEXT_PUBLIC_SUPABASE_URL ? "실시간 저장" : "데모 저장"}</span><span className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-bold shadow-sm"><CircleUserRound size={17}/><span className="hidden sm:inline">{activeStudent?.name ?? "학생"}</span></span></div></div>
        <div className="shell border-t border-black/5 py-1"><StepNav active={step} onChange={setStep} maxIndex={maxIndex}/></div>
      </header>
      <main className="shell py-8 md:py-12">
        {step === "work" ? <WorkPicker team={team} onSelect={(workId: WorkId) => store.selectWork(team.id, workId)} onNext={() => advance("roles", "role-assignment")}/> : null}
        {step === "roles" ? <RoleAssignment team={team} assignCharacter={(student, character) => store.assignCharacter(team.id, student, character)} assignProductionRole={(student, role) => store.assignProductionRole(team.id, student, role)} addStudent={(name) => store.addStudent(team.id, name)} addCustomCharacter={(character) => store.addCustomCharacter(team.id, character)} removeCustomCharacter={(characterId) => store.removeCustomCharacter(team.id, characterId)} onNext={() => advance("script", "script")}/> : null}
        {step === "script" ? <ScriptBoard team={team} updateScript={(cutId, patch) => store.updateScript(team.id, cutId, patch)} onNext={() => advance("stage", "stage")}/> : null}
        {step === "stage" && studentId ? <StageEditor team={team} studentId={studentId} setItems={setTeamStageItems} confirmStage={confirmTeamStage} onNext={() => advance("music", "music")}/> : null}
        {step === "music" && studentId ? <MusicRoom team={team} studentId={studentId} addCandidate={(candidate) => store.addMusicCandidate(team.id, candidate)} vote={(candidateId) => store.voteMusic(team.id, candidateId, studentId)} selectMusic={(candidateId) => store.selectMusic(team.id, candidateId)} setBgmVolume={(volume) => store.setBgmVolume(team.id, volume)} onNext={() => advance("recording", "recording")}/> : null}
        {step === "recording" ? <RecordingStudio team={team} updateRecording={(recording) => store.updateRecording(team.id, recording)} onNext={() => advance("finish", "rendering")}/> : null}
        {step === "finish" ? <FinalizeStudio team={team} classroom={store.classroom} setFinalVideo={(url) => store.setFinalVideo(team.id, url)} submitTeam={() => store.submitTeam(team.id)}/> : null}
      </main>
      <footer className="shell flex items-center justify-center gap-2 border-t border-black/5 py-7 text-xs text-[var(--muted)]"><BookOpen size={14}/> 작품을 대신 만들지 않습니다. 우리의 해석과 연기를 한 편으로 연결합니다.</footer>
    </div>
  );
}
