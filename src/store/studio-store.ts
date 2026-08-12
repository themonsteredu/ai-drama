"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createDemoClassroom } from "@/lib/demo-data";
import { getVariant } from "@/lib/seed";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  syncFinalVideo,
  syncCustomCharacters,
  syncBgmVolume,
  syncMusicCandidate,
  syncMusicVote,
  syncRecording,
  syncScriptCut,
  syncSelectedMusic,
  syncSelectedWork,
  syncStageConfirmation,
  syncSubmission,
  syncTeamAssignments,
  syncTeamPhase,
  reserveTeamMember,
} from "@/lib/supabase/team-mutations";
import type {
  Classroom,
  CharacterTemplate,
  CutRecording,
  MusicCandidate,
  ProductionRole,
  ScriptCut,
  StageItem,
  Student,
  Team,
  TeamPhase,
  TeamSize,
  WorkId,
} from "@/lib/types";

interface StudioState {
  classroom: Classroom;
  activeTeamId?: string;
  activeStudentId?: string;
  teacherUnlocked: boolean;
  syncError?: string;
  replaceClassroom: (classroom: Classroom) => void;
  updateClassroom: (patch: Partial<Pick<Classroom, "schoolName" | "name" | "teacherName">>) => void;
  joinTeam: (code: string, name: string) => { ok: boolean; message: string; teamId?: string; studentId?: string };
  connectRemoteTeam: (team: Team, studentId: string) => void;
  unlockTeacher: (code: string) => boolean;
  lockTeacher: () => void;
  createTeam: (name: string, size: TeamSize) => Promise<{ ok: boolean; message: string; team?: Team }>;
  addStudent: (teamId: string, name: string) => Promise<{ ok: boolean; message: string }>;
  selectWork: (teamId: string, workId: WorkId) => void;
  assignCharacter: (teamId: string, studentId: string, characterId: string) => void;
  assignProductionRole: (teamId: string, studentId: string, role: ProductionRole) => void;
  addCustomCharacter: (teamId: string, character: Omit<CharacterTemplate, "id">) => void;
  removeCustomCharacter: (teamId: string, characterId: string) => void;
  updateScript: (teamId: string, cutId: string, patch: Partial<ScriptCut>) => void;
  setPhase: (teamId: string, phase: TeamPhase) => void;
  setStageItems: (teamId: string, cutId: string, items: StageItem[]) => void;
  confirmStage: (teamId: string, cutId: string, confirmed: boolean) => void;
  addMusicCandidate: (teamId: string, candidate: MusicCandidate) => void;
  voteMusic: (teamId: string, candidateId: string, studentId: string) => void;
  selectMusic: (teamId: string, candidateId: string) => void;
  setBgmVolume: (teamId: string, volume: number) => void;
  updateRecording: (teamId: string, recording: CutRecording) => void;
  setFinalVideo: (teamId: string, url: string) => void;
  submitTeam: (teamId: string) => void;
  resetDemo: () => void;
}

function updateTeam(classroom: Classroom, teamId: string, updater: (team: Team) => Team): Classroom {
  return { ...classroom, teams: classroom.teams.map((team) => (team.id === teamId ? updater(team) : team)) };
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => {
      const sync = (task: Promise<void>) => {
        set({ syncError: undefined });
        void task.catch((error: unknown) => {
          set({ syncError: error instanceof Error ? error.message : "Supabase 동기화에 실패했습니다." });
        });
      };

      return ({
      classroom: createDemoClassroom(),
      teacherUnlocked: false,
      replaceClassroom: (classroom) => set({ classroom, syncError: undefined }),
      updateClassroom: (patch) => {
        set((state) => ({ classroom: { ...state.classroom, ...patch } }));
        if (isSupabaseConfigured()) {
          const classroom = get().classroom;
          sync(fetch("/api/teacher/dashboard", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ classId: classroom.id, ...patch }),
          }).then(async (response) => {
            if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? "수업 정보를 저장하지 못했습니다.");
          }));
        }
      },
      joinTeam(code, name) {
        const normalizedCode = code.trim().toUpperCase();
        const normalizedName = name.trim();
        const team = get().classroom.teams.find((item) => item.code === normalizedCode);
        if (!team) return { ok: false, message: "모둠 코드를 다시 확인해 주세요." };
        let student = team.students.find((item) => item.name === normalizedName);
        if (!student) {
          if (team.students.length >= team.size) return { ok: false, message: "모둠 정원이 찼습니다. 등록된 이름으로 입장해 주세요." };
          student = { id: crypto.randomUUID(), name: normalizedName, teamId: team.id };
          set((state) => ({ classroom: updateTeam(state.classroom, team.id, (item) => ({ ...item, students: [...item.students, student!] })) }));
        }
        set({ activeTeamId: team.id, activeStudentId: student.id });
        return { ok: true, message: `${team.name}에 입장했습니다.`, teamId: team.id, studentId: student.id };
      },
      connectRemoteTeam(team, studentId) {
        set((state) => ({ classroom: { ...state.classroom, teams: [...state.classroom.teams.filter((item) => item.id !== team.id),team] }, activeTeamId:team.id, activeStudentId:studentId }));
      },
      unlockTeacher(code) {
        const expected = get().classroom.adminCode;
        const ok = code.trim() === expected;
        if (ok) set({ teacherUnlocked: true });
        return ok;
      },
      lockTeacher: () => set({ teacherUnlocked: false }),
      async createTeam(name, size) {
        const classId = get().classroom.id;
        set({ syncError: undefined });
        if (!isSupabaseConfigured()) {
          const team: Team = { id: crypto.randomUUID(), classId, code: `PLAY${Math.floor(10 + Math.random() * 90)}`, name, size, phase: "work-selection", students: [], customCharacters: [], scripts: [], stageItems: {}, stageConfirmed: [], musicCandidates: [], bgmVolume: .16, recordings: [] };
          set((state) => ({ classroom: { ...state.classroom, teams: [...state.classroom.teams, team] } }));
          return { ok: true, message: `모둠 코드 ${team.code} · ${team.size}명 정원으로 만들었습니다.`, team };
        }
        try {
          const response = await fetch("/api/teacher/dashboard", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ classId, name, size }),
          });
          const body = await response.json() as { team?: Team; error?: string };
          if (!response.ok || !body.team) throw new Error(body.error ?? "모둠 코드를 만들지 못했습니다.");
          set((state) => ({ classroom: { ...state.classroom, teams: [body.team!, ...state.classroom.teams.filter((item) => item.id !== body.team!.id)] } }));
          return { ok: true, message: `모둠 코드 ${body.team.code} · ${body.team.size}명 정원으로 만들었습니다.`, team: body.team };
        } catch (error) {
          const message = error instanceof Error ? error.message : "모둠 코드를 만들지 못했습니다.";
          set({ syncError: message });
          return { ok: false, message };
        }
      },
      async addStudent(teamId, name) {
        const normalizedName = name.trim();
        const team = get().classroom.teams.find((item) => item.id === teamId);
        if (!team) return { ok: false, message: "모둠을 찾을 수 없습니다." };
        if (!normalizedName) return { ok: false, message: "학생 이름을 입력해 주세요." };
        if (team.students.some((student) => student.name === normalizedName)) return { ok: false, message: "이미 등록된 이름입니다." };
        if (team.students.length >= team.size) return { ok: false, message: "모둠 정원이 이미 찼습니다." };
        try {
          const student = isSupabaseConfigured()
            ? await reserveTeamMember(teamId, normalizedName)
            : { id: crypto.randomUUID(), name: normalizedName, teamId };
          set((state) => ({ classroom: updateTeam(state.classroom, teamId, (item) => ({ ...item, students: [...item.students, student] })) }));
          return { ok: true, message: `${student.name} 학생을 추가했습니다.` };
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : "학생을 추가하지 못했습니다." };
        }
      },
      selectWork(teamId, workId) {
        set((state) => ({
          classroom: updateTeam(state.classroom, teamId, (team) => {
            const variant = getVariant(workId, team.size);
            const scripts: ScriptCut[] = (variant?.cuts ?? []).map((cut) => {
              const firstSpeaker = variant?.characters.find((character) => character.name === cut.activeCharacters[0]);
              return { ...cut, id: crypto.randomUUID(), participants: cut.activeCharacters, keyLine: "", dialogueLines: [{ id: crypto.randomUUID(), speakerCharacterId: firstSpeaker?.id ?? "", speakerName: firstSpeaker?.name ?? "", text: "", direction: "" }], notes: "", confirmed: false };
            });
            return { ...team, workId, phase: "role-assignment", students: team.students.map((student) => ({ ...student, characterId: undefined, productionRole: undefined })), customCharacters: [], scripts, stageItems: {}, stageConfirmed: [], musicCandidates: [], selectedMusicId: undefined, bgmVolume: .16, recordings: scripts.map((cut) => ({ cutId: cut.id, status: "not-recorded" })), finalVideoUrl: undefined, submittedAt: undefined };
          }),
        }));
        const team = get().classroom.teams.find((item) => item.id === teamId);
        if (team && isSupabaseConfigured()) sync(syncSelectedWork(team));
      },
      assignCharacter(teamId, studentId, characterId) {
        set((state) => ({ classroom: updateTeam(state.classroom, teamId, (team) => ({ ...team, students: team.students.map((student) => student.id === studentId ? { ...student, characterId } : student.characterId === characterId ? { ...student, characterId: undefined } : student) })) }));
        const team = get().classroom.teams.find((item) => item.id === teamId);
        if (team && isSupabaseConfigured()) sync(syncTeamAssignments(team));
      },
      assignProductionRole(teamId, studentId, role) {
        set((state) => ({ classroom: updateTeam(state.classroom, teamId, (team) => ({ ...team, students: team.students.map((student) => student.id === studentId ? { ...student, productionRole: role } : student.productionRole === role ? { ...student, productionRole: undefined } : student) })) }));
        const team = get().classroom.teams.find((item) => item.id === teamId);
        if (team && isSupabaseConfigured()) sync(syncTeamAssignments(team));
      },
      addCustomCharacter(teamId, character) {
        const customCharacter: CharacterTemplate = { ...character, id: `custom-${crypto.randomUUID()}` };
        set((state) => ({ classroom: updateTeam(state.classroom, teamId, (team) => ({ ...team, customCharacters: [...(team.customCharacters ?? []), customCharacter] })) }));
        const team = get().classroom.teams.find((item) => item.id === teamId);
        if (team && isSupabaseConfigured()) sync(syncCustomCharacters(teamId, team.customCharacters ?? []));
      },
      removeCustomCharacter(teamId, characterId) {
        set((state) => ({ classroom: updateTeam(state.classroom, teamId, (team) => ({ ...team, customCharacters: (team.customCharacters ?? []).filter((character) => character.id !== characterId), students: team.students.map((student) => student.characterId === characterId ? { ...student, characterId: undefined } : student) })) }));
        const team = get().classroom.teams.find((item) => item.id === teamId);
        if (team && isSupabaseConfigured()) {
          sync(Promise.all([syncCustomCharacters(teamId, team.customCharacters ?? []), syncTeamAssignments(team)]).then(() => undefined));
        }
      },
      updateScript: (teamId, cutId, patch) => {
        set((state) => ({ classroom: updateTeam(state.classroom, teamId, (team) => ({ ...team, scripts: team.scripts.map((cut) => cut.id === cutId ? { ...cut, ...patch } : cut) })) }));
        const cut = get().classroom.teams.find((team) => team.id === teamId)?.scripts.find((item) => item.id === cutId);
        if (cut && isSupabaseConfigured()) sync(syncScriptCut(teamId, cut));
      },
      setPhase: (teamId, phase) => {
        set((state) => ({ classroom: updateTeam(state.classroom, teamId, (team) => ({ ...team, phase })) }));
        if (isSupabaseConfigured()) sync(syncTeamPhase(teamId, phase));
      },
      setStageItems: (teamId, cutId, items) => set((state) => ({ classroom: updateTeam(state.classroom, teamId, (team) => ({ ...team, stageItems: { ...team.stageItems, [cutId]: items } })) })),
      confirmStage: (teamId, cutId, confirmed) => {
        set((state) => ({ classroom: updateTeam(state.classroom, teamId, (team) => ({ ...team, stageConfirmed: confirmed ? Array.from(new Set([...team.stageConfirmed, cutId])) : team.stageConfirmed.filter((id) => id !== cutId) })) }));
        if (isSupabaseConfigured()) sync(syncStageConfirmation(teamId, cutId, get().activeStudentId, confirmed));
      },
      addMusicCandidate: (teamId, candidate) => {
        set((state) => ({ classroom: updateTeam(state.classroom, teamId, (team) => ({ ...team, musicCandidates: [...team.musicCandidates.filter((item) => item.studentId !== candidate.studentId), candidate], selectedMusicId: candidate.id })) }));
        if (isSupabaseConfigured()) sync(syncMusicCandidate(candidate).then(() => syncSelectedMusic(teamId, candidate.id)));
      },
      voteMusic: (teamId, candidateId, studentId) => {
        set((state) => ({ classroom: updateTeam(state.classroom, teamId, (team) => ({ ...team, musicCandidates: team.musicCandidates.map((candidate) => ({ ...candidate, votes: candidate.id === candidateId ? Array.from(new Set([...candidate.votes, studentId])) : candidate.votes.filter((id) => id !== studentId) })) })) }));
        if (isSupabaseConfigured()) sync(syncMusicVote(teamId, candidateId, studentId));
      },
      selectMusic: (teamId, candidateId) => {
        set((state) => ({ classroom: updateTeam(state.classroom, teamId, (team) => ({ ...team, selectedMusicId: candidateId })) }));
        if (isSupabaseConfigured()) sync(syncSelectedMusic(teamId, candidateId));
      },
      setBgmVolume: (teamId, volume) => {
        const safeVolume = Math.min(.4, Math.max(.04, volume));
        set((state) => ({ classroom: updateTeam(state.classroom, teamId, (team) => ({ ...team, bgmVolume: safeVolume })) }));
        if (isSupabaseConfigured()) sync(syncBgmVolume(teamId, safeVolume));
      },
      updateRecording: (teamId, recording) => {
        set((state) => ({ classroom: updateTeam(state.classroom, teamId, (team) => ({ ...team, recordings: [...team.recordings.filter((item) => item.cutId !== recording.cutId), recording] })) }));
        if (isSupabaseConfigured()) sync(syncRecording(teamId, recording));
      },
      setFinalVideo: (teamId, url) => {
        set((state) => ({ classroom: updateTeam(state.classroom, teamId, (team) => ({ ...team, finalVideoUrl: url, phase: "rendering" })) }));
        const team = get().classroom.teams.find((item) => item.id === teamId);
        if (team && isSupabaseConfigured()) sync(syncFinalVideo(team, url));
      },
      submitTeam: (teamId) => {
        set((state) => ({ classroom: updateTeam(state.classroom, teamId, (team) => ({ ...team, phase: "submitted", submittedAt: new Date().toISOString() })) }));
        const team = get().classroom.teams.find((item) => item.id === teamId);
        if (team && isSupabaseConfigured()) sync(syncSubmission(team));
      },
      resetDemo: () => set({ classroom: createDemoClassroom(), activeTeamId: undefined, activeStudentId: undefined, teacherUnlocked: false, syncError: undefined }),
    });
    },
    { name: "literature-stage-studio-v1", storage: createJSONStorage(() => localStorage), partialize: (state) => ({ classroom: state.classroom, activeTeamId: state.activeTeamId, activeStudentId: state.activeStudentId }) },
  ),
);

export function getActiveTeam(state: StudioState) {
  return state.classroom.teams.find((team) => team.id === state.activeTeamId);
}

export function getActiveStudent(state: StudioState): Student | undefined {
  return getActiveTeam(state)?.students.find((student) => student.id === state.activeStudentId);
}
