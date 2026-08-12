import type { Team } from "@/lib/types";
import { getWork, getVariant } from "@/lib/seed";

export interface ComposeProgress { percent: number; message: string }

function makeSlide(lines: string[], accent: string, label: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1280; canvas.height = 720;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas를 준비할 수 없습니다.");
  const gradient = context.createLinearGradient(0,0,1280,720);
  gradient.addColorStop(0,"#241a18"); gradient.addColorStop(1,"#4e232b");
  context.fillStyle = gradient; context.fillRect(0,0,1280,720);
  context.fillStyle = accent; context.fillRect(86,86,8,548);
  context.fillStyle = "rgba(255,255,255,.58)"; context.font = "700 22px sans-serif"; context.letterSpacing = "5px"; context.fillText(label,130,150);
  lines.forEach((line,index) => {
    context.fillStyle = index === 0 ? "#fff8e9" : index === 1 ? accent : "rgba(255,255,255,.78)";
    context.font = index === 0 ? "800 66px serif" : index === 1 ? "700 34px sans-serif" : "600 25px sans-serif";
    context.fillText(line,130,255 + index * 72);
  });
  context.fillStyle = "rgba(255,255,255,.38)"; context.font = "600 18px sans-serif"; context.fillText("문학이 무대가 되는 순간 · LITERATURE STAGE STUDIO",130,640);
  return new Promise<Blob>((resolve,reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("타이틀 이미지를 만들지 못했습니다.")),"image/png"));
}

function makeSpeakerOverlay(characterName: string, studentName: string, line?: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1280; canvas.height = 720;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("화자 이름표를 준비할 수 없습니다.");
  context.fillStyle = "rgba(15, 18, 25, .88)";
  context.beginPath(); context.roundRect(46, 545, line ? 760 : 460, 125, 20); context.fill();
  context.fillStyle = "#f5c267"; context.font = "800 16px sans-serif"; context.letterSpacing = "3px"; context.fillText("NOW SPEAKING", 76, 582);
  context.fillStyle = "#ffffff"; context.font = "800 38px sans-serif"; context.fillText(characterName, 76, 628);
  context.fillStyle = "rgba(255,255,255,.7)"; context.font = "700 18px sans-serif"; context.fillText(`배우 ${studentName}`, 280, 626);
  if (line) { context.fillStyle = "rgba(255,255,255,.88)"; context.font = "600 20px sans-serif"; context.fillText(`“${line.slice(0, 36)}${line.length > 36 ? "…" : ""}”`, 480, 626); }
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("화자 이름표를 만들지 못했습니다.")), "image/png"));
}

export async function composeFinalVideo(team: Team, classroom: { schoolName: string; name: string }, onProgress: (progress: ComposeProgress) => void) {
  const recordings = team.scripts.map((script) => ({ script, recording: team.recordings.find((item) => item.cutId === script.id) }));
  if (recordings.some(({ recording }) => !recording?.videoUrl || recording.status !== "confirmed")) throw new Error("모든 컷 촬영본을 확정해야 합니다.");
  const work = getWork(team.workId);
  const variant = team.workId ? getVariant(team.workId, team.size) : undefined;
  if (!work || !variant) throw new Error("작품 정보를 찾을 수 없습니다.");
  onProgress({ percent: 3, message: "영상 합성 엔진을 불러오는 중" });
  const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([import("@ffmpeg/ffmpeg"), import("@ffmpeg/util")]);
  const ffmpeg = new FFmpeg();
  const coreBase = process.env.NEXT_PUBLIC_FFMPEG_CORE_BASE_URL || "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
  await ffmpeg.load({ coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, "text/javascript"), wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, "application/wasm") });
  const opening = await makeSlide([work.title, team.name, `${classroom.schoolName} · ${classroom.name}`], work.accent, "OPENING");
  const allCharacters = [...variant.characters, ...(team.customCharacters ?? [])];
  const castLines = team.students.map((student) => {
    const role = allCharacters.find((character) => character.id === student.characterId)?.name ?? "배역 미정";
    return `${role}  ·  ${student.name}`;
  });
  const cast = await makeSlide(["등장인물", ...castLines], work.accent, "CAST");
  const creditLines = team.students.map((student) => `${student.productionRole ?? "함께 제작"}  ·  ${student.name}`);
  const credits = await makeSlide(["CAST & CREW", ...creditLines], work.accent, "ENDING CREDITS");
  await Promise.all([ffmpeg.writeFile("opening.png", await fetchFile(opening)), ffmpeg.writeFile("cast.png", await fetchFile(cast)), ffmpeg.writeFile("credits.png", await fetchFile(credits))]);
  async function slideToVideo(input: string, output: string, seconds: number) {
    await ffmpeg.exec(["-loop","1","-i",input,"-f","lavfi","-i","anullsrc=channel_layout=stereo:sample_rate=48000","-t",String(seconds),"-vf","scale=1280:720,format=yuv420p","-r","30","-c:v","libx264","-preset","ultrafast","-c:a","aac","-shortest",output]);
  }
  await slideToVideo("opening.png","opening.mp4",3);
  await slideToVideo("cast.png","cast.mp4",Math.min(7,3 + team.size * .55));
  onProgress({ percent: 15, message: "오프닝과 등장인물 카드를 만들었어요" });
  const normalized: string[] = [];
  for (let index = 0; index < recordings.length; index += 1) {
    const recording = recordings[index].recording!;
    const input = `cut-${index}.webm`; const output = `cut-${index}.mp4`;
    await ffmpeg.writeFile(input, await fetchFile(recording.videoUrl!));
    if (recording.dubbingUrl) {
      const dubbing = `dubbing-${index}.webm`; await ffmpeg.writeFile(dubbing, await fetchFile(recording.dubbingUrl));
      await ffmpeg.exec(["-i",input,"-i",dubbing,"-map","0:v","-map","1:a","-vf","scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p","-r","30","-c:v","libx264","-preset","ultrafast","-c:a","aac","-ar","48000","-ac","2","-shortest",output]);
    } else {
      await ffmpeg.exec(["-i",input,"-vf","scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p","-r","30","-c:v","libx264","-preset","ultrafast","-c:a","aac","-ar","48000","-ac","2",output]);
    }
    const storedCues = recording.speakerCues ?? [];
    const fallbackCues = recordings[index].script.dialogueLines.flatMap((line, lineIndex) => {
      const student = team.students.find((member) => member.characterId === line.speakerCharacterId);
      return student ? [{ id: `fallback-${index}-${lineIndex}`, characterId: line.speakerCharacterId, characterName: line.speakerName, studentName: student.name, atMs: lineIndex * 3200, text: line.text }] : [];
    });
    const cues = storedCues.length ? storedCues : fallbackCues;
    if (cues.length) {
      const overlayFiles: string[] = [];
      for (let cueIndex = 0; cueIndex < cues.length; cueIndex += 1) {
        const fileName = `speaker-${index}-${cueIndex}.png`;
        await ffmpeg.writeFile(fileName, await fetchFile(await makeSpeakerOverlay(cues[cueIndex].characterName, cues[cueIndex].studentName, cues[cueIndex].text)));
        overlayFiles.push(fileName);
      }
      const labeledOutput = `labeled-${index}.mp4`;
      const inputArgs = overlayFiles.flatMap((fileName) => ["-i", fileName]);
      let previous = "[0:v]";
      const filters = cues.map((cue, cueIndex) => {
        const start = Math.max(0, cue.atMs / 1000);
        const nextStart = cues[cueIndex + 1]?.atMs ? cues[cueIndex + 1].atMs / 1000 : start + 3.5;
        const end = Math.max(start + .8, nextStart);
        const outputLabel = `[speaker${cueIndex}]`;
        const filter = `${previous}[${cueIndex + 1}:v]overlay=0:0:eof_action=repeat:enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'${outputLabel}`;
        previous = outputLabel;
        return filter;
      });
      await ffmpeg.exec(["-i", output, ...inputArgs, "-filter_complex", filters.join(";"), "-map", previous, "-map", "0:a?", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "copy", "-shortest", labeledOutput]);
      normalized.push(labeledOutput);
    } else {
      normalized.push(output);
    }
    onProgress({ percent: 18 + Math.round(((index + 1) / recordings.length) * 52), message: `컷 ${index + 1}/${recordings.length} 화질·소리·화자 이름표를 맞추는 중` });
  }
  await slideToVideo("credits.png","credits.mp4",5);
  const files = ["opening.mp4","cast.mp4",...normalized,"credits.mp4"];
  await ffmpeg.writeFile("concat.txt", new TextEncoder().encode(files.map((file) => `file '${file}'`).join("\n")));
  await ffmpeg.exec(["-f","concat","-safe","0","-i","concat.txt","-c","copy","joined.mp4"]);
  onProgress({ percent: 80, message: "장면을 순서대로 이어 붙였어요" });
  const selectedMusic = team.musicCandidates.find((candidate) => candidate.id === team.selectedMusicId);
  if (selectedMusic?.source === "upload") {
    await ffmpeg.writeFile("bgm", await fetchFile(selectedMusic.url));
    const bgmVolume = Math.min(.4, Math.max(.04, team.bgmVolume ?? .16));
    await ffmpeg.exec(["-i","joined.mp4","-stream_loop","-1","-i","bgm","-filter_complex",`[1:a]volume=${bgmVolume.toFixed(3)}[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[a]`,"-map","0:v","-map","[a]","-c:v","copy","-c:a","aac","-shortest","final.mp4"]);
  } else {
    await ffmpeg.exec(["-i","joined.mp4","-c","copy","final.mp4"]);
  }
  onProgress({ percent: 96, message: "대사가 잘 들리도록 음악 음량을 맞췄어요" });
  const data = await ffmpeg.readFile("final.mp4");
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  onProgress({ percent: 100, message: "영상연극 완성!" });
  return new Blob([bytes], { type: "video/mp4" });
}
