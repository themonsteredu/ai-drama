import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { loadEnvFile } from "node:process";
import { ASSET_MANIFEST } from "../src/lib/assets/manifest";
import { CLASSIC_WORKS } from "../src/lib/seed";

try {
  loadEnvFile(".env.local");
} catch (error: unknown) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
const supabase = createClient(url,key,{auth:{persistSession:false}});

async function seed() {
  for (const work of CLASSIC_WORKS) {
    const {variants,...base} = work;
    const {error:workError} = await supabase.from("works").upsert({ id:base.id,title:base.title,tagline:base.tagline,easy_context:base.easyContext,highlight_title:base.highlightTitle,scene_context:base.sceneContext,props:base.props,backgrounds:base.backgrounds,emotions:base.emotions,bgm_keywords:base.bgmKeywords,color:base.color,accent:base.accent });
    if (workError) throw workError;
    for (const size of [4,5,6] as const) {
      const variantId = `${work.id}-${size}`;
      const {error:variantError} = await supabase.from("work_variants").upsert({id:variantId,work_id:work.id,team_size:size}); if (variantError) throw variantError;
      const {error:characterError} = await supabase.from("characters").upsert(variants[size].characters.map((character,index) => ({id:`${variantId}-role-${index+1}`,variant_id:variantId,name:character.name,sort_order:index+1,personality:character.personality,action_cue:character.actionCue,line_cue:character.lineCue}))); if (characterError) throw characterError;
      const {error:cutError} = await supabase.from("cut_templates").upsert(variants[size].cuts.map((cut) => ({id:`${variantId}-cut-${cut.order}`,variant_id:variantId,sort_order:cut.order,title:cut.title,summary:cut.summary,active_characters:cut.activeCharacters,emotions:cut.emotion,line_prompt:cut.linePrompt,props:cut.props,atmosphere:cut.atmosphere}))); if (cutError) throw cutError;
    }
  }
  const {error:assetError} = await supabase.from("stage_assets").upsert(ASSET_MANIFEST.map((asset) => ({id:asset.id,work_id:asset.workId === "shared" ? null : asset.workId,category:asset.category,title:asset.title,file_path:asset.filePath,width:asset.width,height:asset.height,default_scale:asset.defaultScale,facing_options:asset.facingOptions,allowed_rotations:asset.allowedRotations,tags:asset.tags}))); if (assetError) throw assetError;
  const classId = "00000000-0000-4000-8000-000000000101";
  const {error:classError} = await supabase.from("drama_classes").upsert({id:classId,school_name:"한빛중학교",name:"2학년 3반 고전문학 영상연극",teacher_name:"김문학",admin_code_hash:createHash("sha256").update(process.env.TEACHER_ADMIN_CODE || "STAGE2026").digest("hex")}); if (classError) throw classError;
  const teamSeeds = [
    {id:"00000000-0000-4000-8000-000000000201",code:"MOON24",name:"달빛극단",size:4,phase:"script",work_id:"chunhyang",names:["민서","지후","서윤","도현"]},
    {id:"00000000-0000-4000-8000-000000000202",code:"WAVE55",name:"물결스튜디오",size:5,phase:"stage",work_id:"byeoljubu",names:["하린","준서","유나","시우","채원"]},
    {id:"00000000-0000-4000-8000-000000000203",code:"STAR66",name:"별무대",size:6,phase:"recording",work_id:"heungbu",names:["예준","소율","현우","다은","건우","지아"]},
  ] as const;
  const {error:teamError} = await supabase.from("teams").upsert(teamSeeds.map(({id,code,name,size,phase,work_id}) => ({id,code,name,size,phase,work_id,class_id:classId}))); if (teamError) throw teamError;
  let studentNumber = 301;
  for (const team of teamSeeds) {
    const work = CLASSIC_WORKS.find((item) => item.id === team.work_id)!; const variant = work.variants[team.size];
    for (let index=0;index<team.names.length;index+=1) {
      const studentId = `00000000-0000-4000-8000-${String(studentNumber).padStart(12,"0")}`; studentNumber += 1;
      const {error:studentError} = await supabase.from("drama_students").upsert({id:studentId,display_name:team.names[index]}); if (studentError) throw studentError;
      const {error:memberError} = await supabase.from("team_members").upsert({team_id:team.id,student_id:studentId,character_id:`${team.work_id}-${team.size}-role-${index+1}`,production_role:["연출","각색/시나리오","촬영관리","장면관리/편집관리","소품/무대관리","기록/진행"][index]},{onConflict:"team_id,student_id"}); if (memberError) throw memberError;
    }
    const {error:scriptError} = await supabase.from("scripts").upsert(variant.cuts.map((cut) => ({team_id:team.id,template_id:`${team.work_id}-${team.size}-cut-${cut.order}`,sort_order:cut.order,title:cut.title,summary:cut.summary,participants:cut.activeCharacters,emotions:cut.emotion,key_line:cut.linePrompt,props:cut.props,atmosphere:cut.atmosphere,confirmed:["stage","music","recording","rendering","submitted"].includes(team.phase)})),{onConflict:"team_id,sort_order"}); if (scriptError) throw scriptError;
  }
  console.log(`Supabase seed 완료: 작품 ${CLASSIC_WORKS.length}개, 에셋 슬롯 ${ASSET_MANIFEST.length}개`);
}
void seed();
