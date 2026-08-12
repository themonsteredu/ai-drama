import { PRODUCTION_ROLES, SAMPLE_CLASSROOM, getVariant } from "@/lib/seed";
import type { Classroom, ScriptCut, Team } from "@/lib/types";

function hydrateTeam(team: Team): Team {
  if (!team.workId) return team;
  const variant = getVariant(team.workId, team.size);
  if (!variant) return team;
  const students = team.students.map((student, index) => ({
    ...student,
    characterId: variant.characters[index]?.id,
    productionRole: PRODUCTION_ROLES[index],
  }));
  const scripts: ScriptCut[] = variant.cuts.map((cut, index) => ({
    ...cut,
    id: `${team.id}-cut-${index + 1}`,
    participants: cut.activeCharacters,
    keyLine: cut.linePrompt,
    dialogueLines: cut.modelDialogue.map((line, lineIndex) => ({ ...line, id: `${team.id}-cut-${index + 1}-line-${lineIndex + 1}` })),
    notes: index === 0 ? "활동지에서 정한 동선을 촬영 전에 한 번 맞춘다." : "",
    confirmed: ["stage", "music", "recording", "rendering", "submitted"].includes(team.phase),
  }));
  const recordings = scripts.map((script, index) => ({
    cutId: script.id,
    status: team.phase === "recording" && index < Math.max(1, team.size - 2) ? ("confirmed" as const) : ("not-recorded" as const),
  }));
  return { ...team, students, scripts, recordings };
}

export function createDemoClassroom(): Classroom {
  return { ...structuredClone(SAMPLE_CLASSROOM), teams: SAMPLE_CLASSROOM.teams.map(hydrateTeam) };
}
