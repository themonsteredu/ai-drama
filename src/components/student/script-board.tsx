"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  MessageSquarePlus,
  Printer,
  Save,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { getVariant, getWork } from "@/lib/seed";
import type { DialogueLine, ScriptCut, Team } from "@/lib/types";

interface ScriptBoardProps {
  team: Team;
  updateScript: (cutId: string, patch: Partial<ScriptCut>) => void;
  onNext: () => void;
}

export function ScriptBoard({ team, updateScript, onNext }: ScriptBoardProps) {
  const [openCut, setOpenCut] = useState<string | undefined>(team.scripts[0]?.id);
  const [exampleCutId, setExampleCutId] = useState<string>();
  const work = getWork(team.workId);
  const variant = team.workId ? getVariant(team.workId, team.size) : undefined;
  const characters = [...(variant?.characters ?? []), ...(team.customCharacters ?? [])];
  const cast = team.students.flatMap((student) => {
    const character = characters.find((item) => item.id === student.characterId);
    return character ? [{ ...character, studentName: student.name }] : [];
  });
  const complete = team.scripts.every(
    (cut) =>
      cut.summary.trim() &&
      cut.participants.length > 0 &&
      cut.dialogueLines.some((line) => line.speakerCharacterId && line.text.trim()),
  );

  function updateDialogue(cut: ScriptCut, lineId: string, patch: Partial<DialogueLine>) {
    const dialogueLines = cut.dialogueLines.map((line) =>
      line.id === lineId ? { ...line, ...patch } : line,
    );
    updateScript(cut.id, {
      dialogueLines,
      keyLine: dialogueLines.find((line) => line.text.trim())?.text ?? "",
    });
  }

  function addDialogue(cut: ScriptCut) {
    const firstSpeaker = cast[0];
    updateScript(cut.id, {
      dialogueLines: [
        ...cut.dialogueLines,
        {
          id: crypto.randomUUID(),
          speakerCharacterId: firstSpeaker?.id ?? "",
          speakerName: firstSpeaker?.name ?? "",
          text: "",
          direction: "",
        },
      ],
    });
  }

  function removeDialogue(cut: ScriptCut, lineId: string) {
    const dialogueLines = cut.dialogueLines.filter((line) => line.id !== lineId);
    updateScript(cut.id, {
      dialogueLines,
      keyLine: dialogueLines.find((line) => line.text.trim())?.text ?? "",
    });
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">STEP 3 · 활동지 기반 시나리오</p>
          <h2 className="display-serif mt-2 text-4xl font-bold">{team.size}개의 컷, 우리 말로 쓰는 대사</h2>
          <p className="mt-2 text-[var(--muted)]">먼저 모둠이 직접 창작하고, 막힐 때만 교사용 모범대사를 참고하세요.</p>
        </div>
        {team.workId ? (
          <Link className="btn btn-secondary" href={`/worksheet/${team.workId}/${team.size}`} target="_blank">
            <Printer size={17}/> 학생용 활동지
          </Link>
        ) : null}
      </div>

      <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[rgba(200,154,81,.09)] p-5">
        <strong>{work?.highlightTitle}</strong>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{work?.sceneContext}</p>
      </div>

      <div className="mt-6 space-y-3">
        {team.scripts.map((cut) => {
          const open = openCut === cut.id;
          const showExample = exampleCutId === cut.id;
          return (
            <article key={cut.id} className="overflow-hidden rounded-[24px] border border-[var(--line)] bg-white/70">
              <button type="button" className="focus-ring flex w-full items-center gap-4 px-5 py-4 text-left" onClick={() => setOpenCut(open ? undefined : cut.id)}>
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--wine)] font-black text-white">{cut.order}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-extrabold">{cut.title}</h3>
                  <p className="mt-1 truncate text-xs text-[var(--muted)]">{cut.summary}</p>
                </div>
                {cut.confirmed ? <CheckCircle2 className="text-[var(--teal)]" size={20}/> : null}
                {open ? <ChevronUp size={18}/> : <ChevronDown size={18}/>} 
              </button>

              {open ? (
                <div className="grid gap-5 border-t border-[var(--line)] p-5 lg:grid-cols-2">
                  <label className="block text-sm font-bold">컷 제목
                    <input className="input mt-2" value={cut.title} onChange={(event) => updateScript(cut.id, { title: event.target.value })}/>
                  </label>
                  <label className="block text-sm font-bold">감정
                    <input className="input mt-2" value={cut.emotion.join(", ")} onChange={(event) => updateScript(cut.id, { emotion: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })}/>
                  </label>
                  <label className="block text-sm font-bold lg:col-span-2">이 컷에서 무슨 일이 일어나나요?
                    <textarea className="input mt-2 min-h-24 resize-y" value={cut.summary} onChange={(event) => updateScript(cut.id, { summary: event.target.value })}/>
                  </label>
                  <label className="block text-sm font-bold">등장인물
                    <input className="input mt-2" value={cut.participants.join(", ")} onChange={(event) => updateScript(cut.id, { participants: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })}/>
                  </label>
                  <label className="block text-sm font-bold">필요한 소품
                    <input className="input mt-2" value={cut.props.join(", ")} onChange={(event) => updateScript(cut.id, { props: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })}/>
                  </label>

                  <section className="rounded-2xl border-2 border-blue-100 bg-blue-50/45 p-4 lg:col-span-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="eyebrow text-blue-700">우리 모둠 창작 대사</p>
                        <h4 className="mt-1 text-lg font-extrabold">누가, 어떤 말과 행동을 하나요?</h4>
                        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">대사는 정답이 없습니다. 작품의 갈등과 인물의 성격이 드러나게 직접 써 보세요.</p>
                      </div>
                      <button type="button" className="btn btn-secondary min-h-10 px-3 text-sm" onClick={() => setExampleCutId(showExample ? undefined : cut.id)}>
                        <Lightbulb size={15}/>{showExample ? "모범대사 닫기" : "교사용 모범대사"}
                      </button>
                    </div>

                    {showExample ? (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-black text-amber-800">학생이 먼저 작성한 뒤, 교사가 발문·피드백용으로 보여 주세요.</p>
                        <div className="mt-3 space-y-2">
                          {cut.modelDialogue.map((line, index) => (
                            <p key={`${line.speakerCharacterId}-${index}`} className="text-sm leading-6"><strong>{line.speakerName}</strong> <span className="text-[var(--muted)]">({line.direction})</span><br/>“{line.text}”</p>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 space-y-3">
                      {cut.dialogueLines.map((line, lineIndex) => (
                        <div key={line.id} className="grid gap-3 rounded-xl border border-blue-100 bg-white p-3 md:grid-cols-[170px_1fr_auto]">
                          <label className="text-xs font-bold">말하는 인물
                            <select className="input mt-1" value={line.speakerCharacterId} onChange={(event) => {
                              const speaker = cast.find((item) => item.id === event.target.value);
                              updateDialogue(cut, line.id, { speakerCharacterId: event.target.value, speakerName: speaker?.name ?? "" });
                            }}>
                              <option value="">인물 선택</option>
                              {cast.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.studentName}</option>)}
                            </select>
                          </label>
                          <div className="grid gap-2">
                            <label className="text-xs font-bold">대사 {lineIndex + 1}
                              <textarea className="input mt-1 min-h-20 resize-y" value={line.text} placeholder="인물의 마음이 드러나는 말을 직접 써 보세요." onChange={(event) => updateDialogue(cut, line.id, { text: event.target.value })}/>
                            </label>
                            <label className="text-xs font-bold">말할 때의 행동·표정
                              <input className="input mt-1" value={line.direction} placeholder="예: 눈을 마주치며 단호하게" onChange={(event) => updateDialogue(cut, line.id, { direction: event.target.value })}/>
                            </label>
                          </div>
                          <button type="button" className="grid size-9 place-items-center self-start rounded-full bg-red-50 text-red-700" aria-label={`대사 ${lineIndex + 1} 삭제`} onClick={() => removeDialogue(cut, line.id)}><Trash2 size={15}/></button>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="btn btn-secondary mt-3 min-h-10 text-sm" onClick={() => addDialogue(cut)}><MessageSquarePlus size={16}/> 대사 추가</button>
                  </section>

                  <label className="block text-sm font-bold">배경 분위기
                    <input className="input mt-2" value={cut.atmosphere} onChange={(event) => updateScript(cut.id, { atmosphere: event.target.value })}/>
                  </label>
                  <label className="block text-sm font-bold">행동·촬영 메모
                    <input className="input mt-2" value={cut.notes} onChange={(event) => updateScript(cut.id, { notes: event.target.value })}/>
                  </label>
                  <button className={`btn lg:col-span-2 ${cut.confirmed ? "btn-teal" : "btn-secondary"}`} type="button" onClick={() => updateScript(cut.id, { confirmed: !cut.confirmed })}>
                    <Save size={17}/>{cut.confirmed ? "이 컷 모둠 합의 완료" : "모둠 합의 완료로 표시"}
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      <div className="mt-7 flex justify-end"><button className="btn btn-primary" disabled={!complete} onClick={onNext}>공동 무대 설계하기</button></div>
      {!complete ? <p className="mt-3 text-right text-xs text-[var(--muted)]">모든 컷에 사건·등장인물·대사를 하나 이상 작성하면 다음 단계가 열립니다.</p> : null}
    </section>
  );
}
