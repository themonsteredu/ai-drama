import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getVariant } from "@/lib/seed";
import type { CharacterTemplate, CutRecording, DialogueLine, MusicCandidate, ScriptCut, SpeakerCue, StageItem, Student, Team, TeamPhase, TeamSize, WorkId } from "@/lib/types";

type JoinResult = { team_id: string; student_id: string; team_name: string };
type TeamRow = { id:string; class_id:string; code:string; name:string; size:number; phase:TeamPhase; work_id:WorkId | null; custom_characters:CharacterTemplate[]; bgm_volume:number };
type StudentRow = { id:string; display_name:string };
type MemberRow = { student_id:string; character_id:string | null; production_role:Student["productionRole"] | null };
type ScriptRow = { id:string; sort_order:number; title:string; summary:string; participants:string[]; emotions:string[]; key_line:string; dialogue_lines:DialogueLine[]; props:string[]; atmosphere:string; notes:string; confirmed:boolean };
type LayoutRow = { id:string; script_id:string; confirmed:boolean };
type StageRow = { id:string; layout_id:string; cut_id:string; asset_id:string; x:number; y:number; scale:number; rotation:number; facing:"left"|"right"; z_index:number; locked_by:string|null };
type CandidateRow = { id:string; team_id:string; student_id:string; title:string; source:"upload"|"link"; url:string; mood:string; selected:boolean };
type VoteRow = { candidate_id:string; student_id:string };
type RecordingRow = { id:string; script_id:string; public_url:string|null; status:CutRecording["status"]; duration_seconds:number|null; speaker_cues:SpeakerCue[] };
type DubbingRow = { recording_id:string; public_url:string; active:boolean };

export async function joinTeamWithSupabase(code: string, name: string) {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase가 설정되지 않았습니다.");
  const { data:session } = await supabase.auth.getSession();
  if (!session.session) {
    const {error} = await supabase.auth.signInAnonymously({options:{data:{display_name:name.trim()}}});
    if (error) throw error;
  }
  const {data:joined,error:joinError} = await supabase.rpc("join_team",{team_code:code.trim().toUpperCase(),student_name:name.trim()});
  if (joinError) throw joinError;
  const result = joined as JoinResult;
  const [teamQuery,membersQuery,scriptsQuery,layoutsQuery,candidatesQuery,votesQuery,recordingsQuery,finalQuery] = await Promise.all([
    supabase.from("teams").select("id,class_id,code,name,size,phase,work_id,custom_characters,bgm_volume").eq("id",result.team_id).single(),
    supabase.from("team_members").select("student_id,character_id,production_role").eq("team_id",result.team_id),
    supabase.from("scripts").select("id,sort_order,title,summary,participants,emotions,key_line,dialogue_lines,props,atmosphere,notes,confirmed").eq("team_id",result.team_id).order("sort_order"),
    supabase.from("stage_layouts").select("id,script_id,confirmed").eq("team_id",result.team_id),
    supabase.from("music_candidates").select("id,team_id,student_id,title,source,url,mood,selected").eq("team_id",result.team_id),
    supabase.from("music_votes").select("candidate_id,student_id").eq("team_id",result.team_id),
    supabase.from("recordings").select("id,script_id,public_url,status,duration_seconds,speaker_cues").eq("team_id",result.team_id),
    supabase.from("final_videos").select("public_url,render_status").eq("team_id",result.team_id).eq("render_status","completed").order("completed_at",{ascending:false}).limit(1),
  ]);
  const firstError = [teamQuery,membersQuery,scriptsQuery,layoutsQuery,candidatesQuery,votesQuery,recordingsQuery,finalQuery].find((query) => query.error)?.error;
  if (firstError) throw firstError;
  const teamRow = teamQuery.data as TeamRow;
  const memberRows = (membersQuery.data ?? []) as MemberRow[];
  const studentQuery = memberRows.length ? await supabase.from("drama_students").select("id,display_name").in("id",memberRows.map((member) => member.student_id)) : {data:[],error:null};
  if (studentQuery.error) throw studentQuery.error;
  const studentRows = (studentQuery.data ?? []) as StudentRow[];
  const layoutRows = (layoutsQuery.data ?? []) as LayoutRow[];
  const stageQuery = layoutRows.length ? await supabase.from("stage_items").select("id,layout_id,cut_id,asset_id,x,y,scale,rotation,facing,z_index,locked_by").in("layout_id",layoutRows.map((layout) => layout.id)) : {data:[],error:null};
  if (stageQuery.error) throw stageQuery.error;
  const recordingRows = (recordingsQuery.data ?? []) as RecordingRow[];
  const dubbingQuery = recordingRows.length ? await supabase.from("dubbings").select("recording_id,public_url,active").in("recording_id",recordingRows.map((recording) => recording.id)).eq("active",true) : {data:[],error:null};
  if (dubbingQuery.error) throw dubbingQuery.error;
  const scriptRows = (scriptsQuery.data ?? []) as ScriptRow[];
  const variant = teamRow.work_id ? getVariant(teamRow.work_id, teamRow.size as TeamSize) : undefined;
  const allCharacters = [...(variant?.characters ?? []), ...(teamRow.custom_characters ?? [])];
  const scripts: ScriptCut[] = scriptRows.map((row) => {
    const template = variant?.cuts.find((cut) => cut.order === row.sort_order);
    const legacySpeaker = allCharacters.find((character) => character.name === row.participants[0]);
    const dialogueLines = row.dialogue_lines?.length ? row.dialogue_lines : row.key_line ? [{id:`${row.id}-legacy-line`,speakerCharacterId:legacySpeaker?.id ?? "",speakerName:legacySpeaker?.name ?? row.participants[0] ?? "등장인물",text:row.key_line,direction:""}] : [];
    return {id:row.id,order:row.sort_order,title:row.title,summary:row.summary,activeCharacters:row.participants,participants:row.participants,emotion:row.emotions,linePrompt:template?.linePrompt ?? row.key_line,keyLine:row.key_line,dialogueLines,props:row.props,atmosphere:row.atmosphere,modelDialogue:template?.modelDialogue ?? [],notes:row.notes,confirmed:row.confirmed};
  });
  const stageItems = ((stageQuery.data ?? []) as StageRow[]).reduce<Record<string,StageItem[]>>((grouped,row) => {
    const pose = row.rotation >= 2000 ? "kneeling" : row.rotation >= 1000 ? "sitting" : "standing";
    const rotation = row.rotation >= 1000 ? row.rotation % 1000 : row.rotation;
    return {...grouped,[row.cut_id]:[...(grouped[row.cut_id] ?? []),{id:row.id,cutId:row.cut_id,assetId:row.asset_id,x:Number(row.x),y:Number(row.y),scale:Number(row.scale),rotation,facing:row.facing,pose,zIndex:row.z_index,lockedBy:row.locked_by ?? undefined}]};
  },{});
  const voteRows = (votesQuery.data ?? []) as VoteRow[];
  const candidates: MusicCandidate[] = ((candidatesQuery.data ?? []) as CandidateRow[]).map((row) => ({id:row.id,teamId:row.team_id,studentId:row.student_id,title:row.title,source:row.source,url:row.url,mood:row.mood,votes:voteRows.filter((vote) => vote.candidate_id === row.id).map((vote) => vote.student_id)}));
  const dubbingRows = (dubbingQuery.data ?? []) as DubbingRow[];
  const team: Team = {
    id:teamRow.id,classId:teamRow.class_id,code:teamRow.code,name:teamRow.name,size:teamRow.size as TeamSize,phase:teamRow.phase,workId:teamRow.work_id ?? undefined,
    students:memberRows.map((member) => { const learner = studentRows.find((student) => student.id === member.student_id); return {id:member.student_id,name:learner?.display_name ?? "학생",teamId:teamRow.id,characterId:member.character_id ?? undefined,productionRole:member.production_role ?? undefined}; }),customCharacters:teamRow.custom_characters ?? [],
    scripts,stageItems,stageConfirmed:layoutRows.filter((layout) => layout.confirmed).map((layout) => layout.script_id),musicCandidates:candidates,
    selectedMusicId:((candidatesQuery.data ?? []) as CandidateRow[]).find((candidate) => candidate.selected)?.id,bgmVolume:Number(teamRow.bgm_volume ?? .16),
    recordings:recordingRows.map((row) => ({cutId:row.script_id,status:row.status,videoUrl:row.public_url ?? undefined,dubbingUrl:dubbingRows.find((dubbing) => dubbing.recording_id === row.id)?.public_url,duration:row.duration_seconds ?? undefined,speakerCues:row.speaker_cues ?? []})),
    finalVideoUrl:(finalQuery.data?.[0] as {public_url?:string} | undefined)?.public_url,
  };
  return {team,studentId:result.student_id};
}
