"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Copy, Drama, Plus, Printer, Trash2, UserPlus, Wrench } from "lucide-react";
import { getCharacterPortrait } from "@/lib/assets/manifest";
import { PRODUCTION_ROLES, getVariant } from "@/lib/seed";
import type { CharacterTemplate, ProductionRole, Team } from "@/lib/types";

type AddStudentResult = { ok: boolean; message: string };

interface RoleAssignmentProps {
  team: Team;
  assignCharacter: (studentId: string, characterId: string) => void;
  assignProductionRole: (studentId: string, role: ProductionRole) => void;
  addStudent: (name: string) => Promise<AddStudentResult>;
  addCustomCharacter: (character: Omit<CharacterTemplate, "id">) => void;
  removeCustomCharacter: (characterId: string) => void;
  onNext: () => void;
}

export function RoleAssignment({ team, assignCharacter, assignProductionRole, addStudent, addCustomCharacter, removeCustomCharacter, onNext }: RoleAssignmentProps) {
  const [newStudentName, setNewStudentName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState("");
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleTraits, setRoleTraits] = useState("");
  const [roleAction, setRoleAction] = useState("");
  const [roleLine, setRoleLine] = useState("");
  const variant = team.workId ? getVariant(team.workId, team.size) : undefined;
  if (!variant || !team.workId) return null;
  const customCharacters = team.customCharacters ?? [];
  const allCharacters = [...variant.characters, ...customCharacters];
  const missingSeats = team.size - team.students.length;
  const assignments = team.students.map((student) => student.characterId).filter(Boolean);
  const assignedCharacterCount = new Set(assignments).size;
  const assignedProductionCount = team.students.filter((student) => student.productionRole).length;
  const complete = missingSeats === 0 && assignedCharacterCount === team.size && assignedProductionCount === team.size;

  async function submitStudent(event: React.FormEvent) {
    event.preventDefault();
    if (!newStudentName.trim()) return;
    setAdding(true); setAddMessage("");
    const result = await addStudent(newStudentName.trim());
    setAdding(false); setAddMessage(result.message);
    if (result.ok) setNewStudentName("");
  }

  function submitRole(event: React.FormEvent) {
    event.preventDefault();
    if (!roleName.trim()) return;
    addCustomCharacter({
      name: roleName.trim(),
      personality: roleTraits.split(",").map((value) => value.trim()).filter(Boolean),
      actionCue: roleAction.trim() || "장면의 갈등을 움직이는 행동을 직접 정한다.",
      lineCue: roleLine.trim() || "이 인물이 꼭 해야 할 말을 직접 만든다.",
    });
    setRoleName(""); setRoleTraits(""); setRoleAction(""); setRoleLine(""); setShowRoleForm(false);
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">STEP 2 · 역할과 배역</p><h2 className="display-serif mt-2 text-4xl font-bold">전원 배우, 전원 제작자</h2><p className="mt-2 text-[var(--muted)]">한 사람마다 겹치지 않는 배역 하나와 제작 책임 하나를 정합니다.</p></div>
        <Link href={`/worksheet/${team.workId}/${team.size}`} className="btn btn-secondary" target="_blank"><Printer size={17}/> 활동지 인쇄</Link>
      </div>

      <div className="mt-6 grid gap-3 rounded-3xl border border-blue-200 bg-blue-50 p-4 sm:grid-cols-3">
        <div><p className="text-xs font-black tracking-[.12em] text-blue-700">선택한 모둠 정원</p><strong className="mt-1 block text-2xl text-blue-950">{team.size}명</strong></div>
        <div><p className="text-xs font-black tracking-[.12em] text-blue-700">등록된 학생</p><strong className="mt-1 block text-2xl text-blue-950">{team.students.length}/{team.size}명</strong></div>
        <div><p className="text-xs font-black tracking-[.12em] text-blue-700">기본 배역·컷</p><strong className="mt-1 block text-2xl text-blue-950">{variant.characters.length}개 · {variant.cuts.length}컷</strong></div>
        <p className="sm:col-span-3 text-xs font-bold leading-5 text-blue-800">4명을 선택하면 정원이 4명으로 정해집니다. 실제 학생 이름도 4명 모두 등록한 뒤, 각자 배역과 제작 역할을 하나씩 정해야 다음 단계가 열립니다.</p>
      </div>

      {missingSeats > 0 ? (
        <section className="mt-7 overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-blue-600 text-white"><UserPlus size={20}/></span><div><p className="text-xs font-black tracking-[.16em] text-blue-700">CAST INCOMPLETE · {team.students.length}/{team.size}</p><h3 className="mt-1 text-lg font-extrabold">{team.students.length + 1}번째 학생을 추가해 주세요</h3></div></div><button type="button" className="btn btn-secondary min-h-10 px-3 text-sm" onClick={() => void navigator.clipboard?.writeText(team.code)}><Copy size={15}/> 모둠 코드 {team.code}</button></div>
          <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => void submitStudent(event)}><input className="input flex-1" value={newStudentName} onChange={(event) => setNewStudentName(event.target.value)} placeholder={`${team.students.length + 1}번째 학생 이름`} maxLength={20}/><button className="btn btn-primary shrink-0" disabled={adding || !newStudentName.trim()}><Plus size={17}/>{adding ? "추가 중" : "학생 추가하기"}</button></form>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">5인 또는 6인 모둠은 여기에서 인원을 채울 수 있습니다. 학생이 직접 같은 코드로 들어와도 자동으로 합류합니다.</p>
          {addMessage ? <p role="status" className="mt-2 text-sm font-bold text-blue-800">{addMessage}</p> : null}
        </section>
      ) : null}

      <section className="mt-5 rounded-3xl border border-[var(--line)] bg-white/65 p-5">
        <p className="mb-4 rounded-2xl bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900">추가 배역은 모둠 정원을 늘리지 않는 ‘대체 배역 후보’입니다. {team.size}명 팀은 최종적으로 {team.size}개 배역만 학생에게 배정하세요.</p>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">CUSTOM CAST</p><h3 className="mt-1 text-lg font-extrabold">장면에 필요한 배역을 직접 추가</h3><p className="mt-1 text-sm text-[var(--muted)]">이름만 있는 역할이 아니라 반드시 말과 행동으로 장면을 움직이는 역할이어야 합니다.</p></div><button type="button" className="btn btn-secondary" onClick={() => setShowRoleForm((open) => !open)}><Plus size={17}/> 새 배역 만들기</button></div>
        {showRoleForm ? <form className="mt-4 grid gap-3 rounded-2xl bg-black/[.025] p-4 md:grid-cols-2" onSubmit={submitRole}>
          <label className="text-sm font-bold">배역 이름<input className="input mt-2" value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="예: 마을 장터 지킴이"/></label>
          <label className="text-sm font-bold">성격 키워드<input className="input mt-2" value={roleTraits} onChange={(event) => setRoleTraits(event.target.value)} placeholder="용기, 갈등, 재치"/></label>
          <label className="text-sm font-bold">장면을 움직이는 행동<input className="input mt-2" value={roleAction} onChange={(event) => setRoleAction(event.target.value)} placeholder="문을 열어 반전의 계기를 만든다"/></label>
          <label className="text-sm font-bold">대사 힌트<input className="input mt-2" value={roleLine} onChange={(event) => setRoleLine(event.target.value)} placeholder="제가 본 일을 말하겠습니다"/></label>
          <button className="btn btn-primary md:col-span-2" disabled={!roleName.trim()}><Plus size={17}/> 배역 추가</button>
        </form> : null}
      </section>

      <div className="mt-7 overflow-hidden rounded-[28px] border border-[var(--line)] bg-white/65">
        <div className="grid grid-cols-[1fr_1.15fr_1.15fr] gap-3 border-b border-[var(--line)] bg-black/[.025] px-5 py-3 text-xs font-black text-[var(--muted)]"><span>모둠원</span><span className="flex items-center gap-2"><Drama size={14}/> 등장인물</span><span className="flex items-center gap-2"><Wrench size={14}/> 제작 역할</span></div>
        {team.students.map((student, index) => <div key={student.id} className="grid grid-cols-[1fr_1.15fr_1.15fr] items-center gap-3 border-b border-[var(--line)] px-5 py-4 last:border-0"><div><strong>{student.name}</strong><span className="mt-1 block text-xs text-[var(--muted)]">배우 {index + 1}</span></div><select className="input" value={student.characterId ?? ""} onChange={(event) => assignCharacter(student.id, event.target.value)}><option value="">배역 선택</option>{allCharacters.map((character) => <option key={character.id} value={character.id} disabled={team.students.some((member) => member.id !== student.id && member.characterId === character.id)}>{character.name}{customCharacters.some((custom) => custom.id === character.id) ? " · 우리 모둠 배역" : ""}</option>)}</select><select className="input" value={student.productionRole ?? ""} onChange={(event) => assignProductionRole(student.id, event.target.value as ProductionRole)}><option value="">제작 역할 선택</option>{PRODUCTION_ROLES.slice(0, team.size).map((role) => <option key={role} value={role}>{role}</option>)}</select></div>)}
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {allCharacters.map((character) => { const actor = team.students.find((student) => student.characterId === character.id); const isCustom = customCharacters.some((custom) => custom.id === character.id); return <article className="paper-card overflow-hidden rounded-2xl" key={character.id}><div className="relative aspect-[16/10] bg-gradient-to-b from-slate-100 to-blue-50"><Image src={getCharacterPortrait(team.workId!, character.id)} alt={`${character.name} 캐릭터`} fill unoptimized sizes="(max-width: 768px) 100vw, 33vw" className="object-contain object-bottom pt-3"/><span className="badge absolute right-3 top-3 bg-white/90 shadow-sm">{actor?.name ?? "미배정"}</span></div><div className="p-5"><span className="eyebrow">{isCustom ? "ALTERNATE CAST · 대체 배역" : `CAST · ${team.size}인 기본 배역`}</span><div className="flex items-center justify-between gap-2"><h3 className="mt-1 text-xl font-extrabold">{character.name}</h3>{isCustom ? <button type="button" aria-label={`${character.name} 배역 삭제`} className="grid size-8 place-items-center rounded-full bg-red-50 text-red-700" disabled={Boolean(actor)} onClick={() => removeCustomCharacter(character.id)} title={actor ? "배정된 배역은 삭제할 수 없습니다." : "배역 삭제"}><Trash2 size={14}/></button> : null}</div><p className="mt-3 text-sm text-[var(--muted)]">{character.personality.join(" · ")}</p><p className="mt-4 border-l-2 border-[var(--gold)] pl-3 text-sm leading-6">{character.actionCue}</p><p className="mt-2 text-sm font-semibold text-[var(--wine)]">“{character.lineCue}”</p></div></article>; })}
      </div>
      {!complete ? <div className="mt-6 grid gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-950 sm:grid-cols-3"><span>{missingSeats === 0 ? "✓" : "○"} 학생 {team.students.length}/{team.size}명</span><span>{assignedCharacterCount === team.size ? "✓" : "○"} 배역 {assignedCharacterCount}/{team.size}명</span><span>{assignedProductionCount === team.size ? "✓" : "○"} 제작 역할 {assignedProductionCount}/{team.size}명</span></div> : null}
      <div className="mt-7 flex justify-end"><button className="btn btn-primary" disabled={!complete} onClick={onNext}>시나리오 쓰기 <ArrowRight size={17}/></button></div>
      {!complete ? <p className="mt-3 text-right text-xs text-[var(--muted)]">정원을 채우고 모든 학생에게 서로 다른 배역과 제작 역할을 지정해 주세요.</p> : null}
    </section>
  );
}
