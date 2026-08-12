import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { encodeStageItemsForStorage } from "@/lib/stage-item-storage";
import type { CharacterTemplate, CutRecording, MusicCandidate, ScriptCut, StageItem, Student, Team, TeamPhase, WorkId } from "@/lib/types";

function client() {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase 환경변수가 없습니다.");
  return supabase;
}

export async function syncSelectedWork(team: Team) {
  if (!team.workId) return;
  const supabase = client();
  const { error: teamError } = await supabase.from("teams").update({ work_id: team.workId, phase: "role-assignment", updated_at: new Date().toISOString() }).eq("id", team.id);
  if (teamError) throw teamError;
  const { error: memberError } = await supabase.from("team_members").update({ character_id: null, production_role: null }).eq("team_id", team.id);
  if (memberError) throw memberError;
  const { error: deleteError } = await supabase.from("scripts").delete().eq("team_id", team.id);
  if (deleteError) throw deleteError;
  const { error: scriptError } = await supabase.from("scripts").insert(team.scripts.map((cut) => ({
    id: cut.id,
    team_id: team.id,
    template_id: `${team.workId}-${team.size}-cut-${cut.order}`,
    sort_order: cut.order,
    title: cut.title,
    summary: cut.summary,
    participants: cut.participants,
    emotions: cut.emotion,
    key_line: cut.keyLine,
    dialogue_lines: cut.dialogueLines,
    props: cut.props,
    atmosphere: cut.atmosphere,
    notes: cut.notes,
    confirmed: cut.confirmed,
  })));
  if (scriptError) throw scriptError;
}

export async function reserveTeamMember(teamId: string, name: string): Promise<Student> {
  const { data, error } = await client().rpc("reserve_team_member", {
    target_team: teamId,
    student_name: name.trim(),
  });
  if (error) throw error;
  const result = data as { student_id: string; display_name: string };
  return { id: result.student_id, name: result.display_name, teamId };
}

export async function syncTeamPhase(teamId: string, phase: TeamPhase) {
  const { error } = await client().from("teams").update({ phase, updated_at: new Date().toISOString() }).eq("id", teamId);
  if (error) throw error;
}

export async function syncMemberAssignment(teamId: string, student: Student) {
  const { error } = await client().from("team_members").update({ character_id: student.characterId ?? null, production_role: student.productionRole ?? null }).eq("team_id", teamId).eq("student_id", student.id);
  if (error) throw error;
}

export async function syncTeamAssignments(team: Team) {
  const supabase = client();
  const { error: clearError } = await supabase.from("team_members").update({ character_id: null, production_role: null }).eq("team_id", team.id);
  if (clearError) throw clearError;
  for (const student of team.students) {
    const { error } = await supabase.from("team_members").update({ character_id: student.characterId ?? null, production_role: student.productionRole ?? null }).eq("team_id", team.id).eq("student_id", student.id);
    if (error) throw error;
  }
}

export async function syncCustomCharacters(teamId: string, characters: CharacterTemplate[]) {
  const { error } = await client().from("teams").update({ custom_characters: characters, updated_at: new Date().toISOString() }).eq("id", teamId);
  if (error) throw error;
}

export async function syncScriptCut(teamId: string, cut: ScriptCut) {
  const { error } = await client().from("scripts").update({ title:cut.title,summary:cut.summary,participants:cut.participants,emotions:cut.emotion,key_line:cut.keyLine,dialogue_lines:cut.dialogueLines,props:cut.props,atmosphere:cut.atmosphere,notes:cut.notes,confirmed:cut.confirmed,updated_at:new Date().toISOString() }).eq("id",cut.id).eq("team_id",teamId);
  if (error) throw error;
}

export async function syncStageConfirmation(teamId: string, cutId: string, studentId: string | undefined, confirmed: boolean) {
  const { error } = await client().from("stage_layouts").upsert({ team_id:teamId,script_id:cutId,confirmed,updated_by:studentId ?? null,updated_at:new Date().toISOString() },{onConflict:"team_id,script_id"});
  if (error) throw error;
}

export async function syncMusicCandidate(candidate: MusicCandidate) {
  const supabase = client();
  const { error: deleteError } = await supabase.from("music_candidates").delete().eq("team_id",candidate.teamId).eq("student_id",candidate.studentId).neq("id",candidate.id);
  if (deleteError) throw deleteError;
  const { error } = await supabase.from("music_candidates").upsert({ id:candidate.id,team_id:candidate.teamId,student_id:candidate.studentId,title:candidate.title,source:candidate.source,url:candidate.url,mood:candidate.mood },{onConflict:"id"});
  if (error) throw error;
}

export async function syncMusicVote(teamId: string, candidateId: string, studentId: string) {
  const supabase = client();
  const { error:deleteError } = await supabase.from("music_votes").delete().eq("team_id",teamId).eq("student_id",studentId);
  if (deleteError) throw deleteError;
  const { error:insertError } = await supabase.from("music_votes").insert({team_id:teamId,candidate_id:candidateId,student_id:studentId});
  if (insertError) throw insertError;
}

export async function syncSelectedMusic(teamId: string, candidateId: string) {
  const supabase = client();
  const { error:clearError } = await supabase.from("music_candidates").update({selected:false}).eq("team_id",teamId);
  if (clearError) throw clearError;
  const { error:selectError } = await supabase.from("music_candidates").update({selected:true}).eq("team_id",teamId).eq("id",candidateId);
  if (selectError) throw selectError;
}

export async function syncBgmVolume(teamId: string, volume: number) {
  const { error } = await client().from("teams").update({ bgm_volume: volume, updated_at: new Date().toISOString() }).eq("id", teamId);
  if (error) throw error;
}

export async function syncRecording(teamId: string, recording: CutRecording) {
  const supabase = client();
  const {data,error} = await supabase.from("recordings").upsert({team_id:teamId,script_id:recording.cutId,public_url:recording.videoUrl ?? null,status:recording.status,duration_seconds:recording.duration ?? null,speaker_cues:recording.speakerCues ?? []},{onConflict:"team_id,script_id"}).select("id").single();
  if (error) throw error;
  if (recording.dubbingUrl) {
    const {error:dubbingError} = await supabase.from("dubbings").upsert({recording_id:data.id,public_url:recording.dubbingUrl,storage_path:recording.dubbingUrl,active:true},{onConflict:"recording_id,public_url"});
    if (dubbingError) throw dubbingError;
  }
}

export async function syncFinalVideo(team: Team, url: string) {
  const supabase = client();
  const {error:videoError} = await supabase.from("final_videos").insert({team_id:team.id,public_url:url,storage_path:url,render_status:"completed",completed_at:new Date().toISOString()});
  if (videoError) throw videoError;
  await syncTeamPhase(team.id,"rendering");
}

export async function syncSubmission(team: Team) {
  const supabase = client();
  const {data:video,error:videoError} = await supabase.from("final_videos").select("id").eq("team_id",team.id).eq("render_status","completed").order("completed_at",{ascending:false}).limit(1).single();
  if (videoError) throw videoError;
  const {error:submissionError} = await supabase.from("submissions").upsert({class_id:team.classId,team_id:team.id,final_video_id:video.id,submitted_at:new Date().toISOString()},{onConflict:"team_id"});
  if (submissionError) throw submissionError;
  await syncTeamPhase(team.id,"submitted");
}

export async function syncStageItems(teamId: string, cutId: string, items: StageItem[]) {
  const {error} = await client().rpc("save_stage_items",{target_team:teamId,target_cut:cutId,payload:encodeStageItemsForStorage(items)});
  if (error) throw error;
}

export async function syncTeamWorkId(teamId: string, workId: WorkId) {
  const {error} = await client().from("teams").update({work_id:workId,updated_at:new Date().toISOString()}).eq("id",teamId);
  if (error) throw error;
}
