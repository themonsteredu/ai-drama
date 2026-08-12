import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { isTeacherAuthenticated } from "@/lib/auth/teacher-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getVariant } from "@/lib/seed";
import type {
  CharacterTemplate,
  Classroom,
  CutRecording,
  MusicCandidate,
  ScriptCut,
  DialogueLine,
  SpeakerCue,
  Student,
  Team,
  TeamPhase,
  TeamSize,
  WorkId,
} from "@/lib/types";

type ClassRow = { id:string; school_name:string; name:string; teacher_name:string };
type TeamRow = { id:string; class_id:string; code:string; name:string; size:number; phase:TeamPhase; work_id:WorkId|null; custom_characters:CharacterTemplate[]; bgm_volume:number };
type MemberRow = { team_id:string; student_id:string; character_id:string|null; production_role:Student["productionRole"]|null };
type StudentRow = { id:string; display_name:string };
type ScriptRow = { id:string; team_id:string; sort_order:number; title:string; summary:string; participants:string[]; emotions:string[]; key_line:string; dialogue_lines:DialogueLine[]; props:string[]; atmosphere:string; notes:string; confirmed:boolean };
type LayoutRow = { team_id:string; script_id:string; confirmed:boolean };
type CandidateRow = { id:string; team_id:string; student_id:string; title:string; source:"upload"|"link"; url:string; mood:string; selected:boolean };
type VoteRow = { team_id:string; candidate_id:string; student_id:string };
type RecordingRow = { id:string; team_id:string; script_id:string; public_url:string|null; status:CutRecording["status"]; duration_seconds:number|null; speaker_cues:SpeakerCue[] };
type DubbingRow = { recording_id:string; public_url:string; active:boolean };
type FinalRow = { id:string; team_id:string; public_url:string|null; completed_at:string|null };
type SubmissionRow = { team_id:string; submitted_at:string };

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function guard() {
  if (!(await isTeacherAuthenticated())) return jsonError("교사 인증이 필요합니다.", 401);
  const admin = createSupabaseAdminClient();
  if (!admin) return jsonError("Supabase 서버 환경변수가 설정되지 않았습니다.", 503);
  return admin;
}

export async function GET(request: Request) {
  const guarded = await guard();
  if (guarded instanceof NextResponse) return guarded;
  const classId = new URL(request.url).searchParams.get("classId");
  const classResult = classId
    ? await guarded.from("drama_classes").select("id,school_name,name,teacher_name").eq("id", classId).single()
    : await guarded.from("drama_classes").select("id,school_name,name,teacher_name").order("created_at").limit(1).maybeSingle();
  if (classResult.error) return jsonError(classResult.error.message, 500);
  if (!classResult.data) return jsonError("수업이 없습니다. seed를 먼저 실행해 주세요.", 404);
  const classRow = classResult.data as ClassRow;
  const teamsResult = await guarded.from("teams").select("id,class_id,code,name,size,phase,work_id,custom_characters,bgm_volume").eq("class_id", classRow.id).order("created_at", { ascending: false });
  if (teamsResult.error) return jsonError(teamsResult.error.message, 500);
  const teamRows = (teamsResult.data ?? []) as TeamRow[];
  const teamIds = teamRows.map((team) => team.id);
  if (!teamIds.length) {
    const classroom: Classroom = { id:classRow.id,schoolName:classRow.school_name,name:classRow.name,teacherName:classRow.teacher_name,adminCode:"",teams:[] };
    return NextResponse.json({ classroom });
  }
  const [membersResult,scriptsResult,layoutsResult,candidatesResult,votesResult,recordingsResult,finalsResult,submissionsResult] = await Promise.all([
    guarded.from("team_members").select("team_id,student_id,character_id,production_role").in("team_id",teamIds),
    guarded.from("scripts").select("id,team_id,sort_order,title,summary,participants,emotions,key_line,dialogue_lines,props,atmosphere,notes,confirmed").in("team_id",teamIds).order("sort_order"),
    guarded.from("stage_layouts").select("team_id,script_id,confirmed").in("team_id",teamIds),
    guarded.from("music_candidates").select("id,team_id,student_id,title,source,url,mood,selected").in("team_id",teamIds),
    guarded.from("music_votes").select("team_id,candidate_id,student_id").in("team_id",teamIds),
    guarded.from("recordings").select("id,team_id,script_id,public_url,status,duration_seconds,speaker_cues").in("team_id",teamIds),
    guarded.from("final_videos").select("id,team_id,public_url,completed_at").in("team_id",teamIds).eq("render_status","completed").order("completed_at",{ascending:false}),
    guarded.from("submissions").select("team_id,submitted_at").in("team_id",teamIds),
  ]);
  const failed = [membersResult,scriptsResult,layoutsResult,candidatesResult,votesResult,recordingsResult,finalsResult,submissionsResult].find((result) => result.error);
  if (failed?.error) return jsonError(failed.error.message, 500);
  const memberRows = (membersResult.data ?? []) as MemberRow[];
  const studentIds = memberRows.map((member) => member.student_id);
  const recordingRows = (recordingsResult.data ?? []) as RecordingRow[];
  const [studentsResult,dubbingsResult] = await Promise.all([
    studentIds.length ? guarded.from("drama_students").select("id,display_name").in("id",studentIds) : Promise.resolve({data:[],error:null}),
    recordingRows.length ? guarded.from("dubbings").select("recording_id,public_url,active").in("recording_id",recordingRows.map((recording) => recording.id)).eq("active",true) : Promise.resolve({data:[],error:null}),
  ]);
  if (studentsResult.error || dubbingsResult.error) return jsonError(studentsResult.error?.message ?? dubbingsResult.error?.message ?? "데이터 조회 실패",500);
  const studentRows = (studentsResult.data ?? []) as StudentRow[];
  const scriptRows = (scriptsResult.data ?? []) as ScriptRow[];
  const layoutRows = (layoutsResult.data ?? []) as LayoutRow[];
  const candidateRows = (candidatesResult.data ?? []) as CandidateRow[];
  const voteRows = (votesResult.data ?? []) as VoteRow[];
  const dubbingRows = (dubbingsResult.data ?? []) as DubbingRow[];
  const finalRows = (finalsResult.data ?? []) as FinalRow[];
  const submissionRows = (submissionsResult.data ?? []) as SubmissionRow[];
  const teams: Team[] = teamRows.map((row) => {
    const members = memberRows.filter((member) => member.team_id === row.id);
    const variant = row.work_id ? getVariant(row.work_id, row.size as TeamSize) : undefined;
    const allCharacters = [...(variant?.characters ?? []), ...(row.custom_characters ?? [])];
    const scripts: ScriptCut[] = scriptRows.filter((script) => script.team_id === row.id).map((script) => {
      const template = variant?.cuts.find((cut) => cut.order === script.sort_order);
      const legacySpeaker = allCharacters.find((character) => character.name === script.participants[0]);
      const dialogueLines = script.dialogue_lines?.length ? script.dialogue_lines : script.key_line ? [{id:`${script.id}-legacy-line`,speakerCharacterId:legacySpeaker?.id ?? "",speakerName:legacySpeaker?.name ?? script.participants[0] ?? "등장인물",text:script.key_line,direction:""}] : [];
      return {id:script.id,order:script.sort_order,title:script.title,summary:script.summary,activeCharacters:script.participants,participants:script.participants,emotion:script.emotions,linePrompt:template?.linePrompt ?? script.key_line,keyLine:script.key_line,dialogueLines,props:script.props,atmosphere:script.atmosphere,modelDialogue:template?.modelDialogue ?? [],notes:script.notes,confirmed:script.confirmed};
    });
    const musicCandidates: MusicCandidate[] = candidateRows.filter((candidate) => candidate.team_id === row.id).map((candidate) => ({
      id:candidate.id,teamId:candidate.team_id,studentId:candidate.student_id,title:candidate.title,source:candidate.source,url:candidate.url,mood:candidate.mood,votes:voteRows.filter((vote) => vote.candidate_id === candidate.id).map((vote) => vote.student_id),
    }));
    const finalVideo = finalRows.find((video) => video.team_id === row.id);
    return {
      id:row.id,classId:row.class_id,code:row.code,name:row.name,size:row.size as TeamSize,phase:row.phase,workId:row.work_id ?? undefined,
      students:members.map((member) => ({id:member.student_id,name:studentRows.find((student) => student.id === member.student_id)?.display_name ?? "학생",teamId:row.id,characterId:member.character_id ?? undefined,productionRole:member.production_role ?? undefined})),customCharacters:row.custom_characters ?? [],
      scripts,stageItems:{},stageConfirmed:layoutRows.filter((layout) => layout.team_id === row.id && layout.confirmed).map((layout) => layout.script_id),musicCandidates,
      selectedMusicId:candidateRows.find((candidate) => candidate.team_id === row.id && candidate.selected)?.id,bgmVolume:Number(row.bgm_volume ?? .16),
      recordings:recordingRows.filter((recording) => recording.team_id === row.id).map((recording) => ({cutId:recording.script_id,status:recording.status,videoUrl:recording.public_url ?? undefined,dubbingUrl:dubbingRows.find((dubbing) => dubbing.recording_id === recording.id)?.public_url,duration:recording.duration_seconds ?? undefined,speakerCues:recording.speaker_cues ?? []})),
      finalVideoUrl:finalVideo?.public_url ?? undefined,submittedAt:submissionRows.find((submission) => submission.team_id === row.id)?.submitted_at,
    };
  });
  const classroom: Classroom = { id:classRow.id,schoolName:classRow.school_name,name:classRow.name,teacherName:classRow.teacher_name,adminCode:"",teams };
  return NextResponse.json({ classroom });
}

export async function PATCH(request: Request) {
  const guarded = await guard();
  if (guarded instanceof NextResponse) return guarded;
  const body = await request.json() as { classId?:string; schoolName?:string; name?:string; teacherName?:string };
  if (!body.classId) return jsonError("classId가 필요합니다.",400);
  const changes: Record<string,string> = {};
  if (body.schoolName !== undefined) changes.school_name = body.schoolName.trim();
  if (body.name !== undefined) changes.name = body.name.trim();
  if (body.teacherName !== undefined) changes.teacher_name = body.teacherName.trim();
  const {error} = await guarded.from("drama_classes").update(changes).eq("id",body.classId);
  if (error) return jsonError(error.message,500);
  return NextResponse.json({ok:true});
}

function makeTeamCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length:6},() => alphabet[randomInt(alphabet.length)]).join("");
}

export async function POST(request: Request) {
  const guarded = await guard();
  if (guarded instanceof NextResponse) return guarded;
  const body = await request.json() as {classId?:string;name?:string;size?:number};
  if (!body.classId || !body.name?.trim() || ![4,5,6].includes(body.size ?? 0)) return jsonError("수업, 모둠명, 4~6명 인원 정보가 필요합니다.",400);
  console.info("[teacher/dashboard] team code creation started", { classId: body.classId, teamName: body.name.trim(), size: body.size });
  const { data: targetClass, error: classError } = await guarded.from("drama_classes").select("id").eq("id", body.classId).maybeSingle();
  if (classError || !targetClass) {
    console.error("[teacher/dashboard] class lookup failed", { classId: body.classId, error: classError?.message ?? "not found" });
    return jsonError("수업 정보를 찾을 수 없습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.", 404);
  }
  let created: TeamRow | undefined;
  for (let attempt=0; attempt<5 && !created; attempt+=1) {
    const {data,error} = await guarded.from("teams").insert({class_id:body.classId,name:body.name.trim(),size:body.size,code:makeTeamCode()}).select("id,class_id,code,name,size,phase,work_id").single();
    if (!error) created = data as TeamRow;
    else if (error.code !== "23505") {
      console.error("[teacher/dashboard] team code creation failed", { classId: body.classId, code: error.code, error: error.message });
      return jsonError(`모둠 코드를 만들지 못했습니다: ${error.message}`,500);
    }
  }
  if (!created) {
    console.error("[teacher/dashboard] unique code retries exhausted", { classId: body.classId });
    return jsonError("고유 모둠 코드를 만들지 못했습니다. 다시 시도해 주세요.",500);
  }
  const team: Team = {id:created.id,classId:created.class_id,code:created.code,name:created.name,size:created.size as TeamSize,phase:created.phase,students:[],customCharacters:[],scripts:[],stageItems:{},stageConfirmed:[],musicCandidates:[],bgmVolume:.16,recordings:[]};
  console.info("[teacher/dashboard] team code creation completed", { teamId: team.id, code: team.code });
  return NextResponse.json({team},{status:201});
}
