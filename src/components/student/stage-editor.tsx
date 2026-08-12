"use client";

import Image from "next/image";
import { useCallback, useMemo, useRef, useState } from "react";
import { Check, FlipHorizontal2, ImageIcon, Layers, LockKeyhole, Minus, PersonStanding, Plus, Redo2, Trash2, Undo2, Users } from "lucide-react";
import { getAsset, getAssetsForWork } from "@/lib/assets/manifest";
import { useStageRealtime } from "@/hooks/use-stage-realtime";
import type { AssetCategory, PresenceMember, StageItem, Team } from "@/lib/types";

const presenceColors = ["#2563eb", "#0f766e", "#b45309", "#7c3aed", "#0369a1", "#be123c"];
const categoryNames: Record<AssetCategory, string> = {
  background: "배경",
  building: "건물",
  character: "인물",
  prop: "소품",
  animal: "동물",
  nature: "자연",
  effect: "효과",
};

interface StageEditorProps {
  team: Team;
  studentId: string;
  setItems: (cutId: string, items: StageItem[]) => void;
  confirmStage: (cutId: string, confirmed: boolean) => void;
  onNext: () => void;
}

export function StageEditor({ team, studentId, setItems, confirmStage, onNext }: StageEditorProps) {
  const [activeCutId, setActiveCutId] = useState(team.scripts[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState<string>();
  const [past, setPast] = useState<StageItem[][]>([]);
  const [future, setFuture] = useState<StageItem[][]>([]);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const activeStudent = team.students.find((student) => student.id === studentId) ?? team.students[0];
  const member = useMemo<PresenceMember>(() => ({
    id: activeStudent?.id ?? "guest",
    name: activeStudent?.name ?? "게스트",
    color: presenceColors[Math.max(0, team.students.findIndex((student) => student.id === studentId)) % presenceColors.length],
  }), [activeStudent?.id, activeStudent?.name, studentId, team.students]);
  const items = team.stageItems[activeCutId] ?? [];
  const assets = team.workId ? getAssetsForWork(team.workId) : [];
  const onRemoteItems = useCallback((remoteItems: StageItem[]) => setItems(activeCutId, remoteItems), [activeCutId, setItems]);
  const realtime = useStageRealtime(team.id, activeCutId, member, onRemoteItems);
  const selected = items.find((item) => item.id === selectedId);
  const selectedAsset = selected ? getAsset(selected.assetId) : undefined;
  const selectedIsBackground = selectedAsset?.category === "background";
  const selectedScaleRange = selectedIsBackground
    ? { min: 1, max: 2.4, step: 0.15 }
    : { min: 0.15, max: 1.2, step: 0.08 };

  function apply(next: StageItem[], record = true) {
    if (record) {
      setPast((history) => [...history.slice(-29), items]);
      setFuture([]);
    }
    setItems(activeCutId, next);
    realtime.broadcast(next);
  }

  function addAsset(assetId: string) {
    const stageAsset = getAsset(assetId);
    if (!stageAsset) return;
    const item: StageItem = {
      id: crypto.randomUUID(),
      cutId: activeCutId,
      assetId,
      x: 50,
      y: stageAsset.category === "background" ? 50 : 65,
      scale: stageAsset.defaultScale,
      rotation: 0,
      facing: "right",
      pose: "standing",
      zIndex: stageAsset.category === "background" ? 0 : items.length + 1,
    };
    const next = stageAsset.category === "background"
      ? [...items.filter((stageItem) => getAsset(stageItem.assetId)?.category !== "background"), item]
      : [...items, item];
    apply(next);
    setSelectedId(item.id);
    void realtime.persist(next);
  }

  function updateSelected(patch: Partial<StageItem>) {
    if (!selected) return;
    const next = items.map((item) => item.id === selected.id ? { ...item, ...patch } : item);
    apply(next);
    void realtime.persist(next);
  }

  function updateSelectedScale(nextScale: number) {
    if (!selected) return;
    const scale = Math.min(selectedScaleRange.max, Math.max(selectedScaleRange.min, nextScale));
    if (!selectedIsBackground) {
      updateSelected({ scale });
      return;
    }
    const min = 100 - 50 * scale;
    const max = 50 * scale;
    updateSelected({
      scale,
      x: Math.min(max, Math.max(min, selected.x)),
      y: Math.min(max, Math.max(min, selected.y)),
    });
  }

  function removeSelected() {
    if (!selected) return;
    const next = items.filter((item) => item.id !== selected.id);
    apply(next);
    setSelectedId(undefined);
    void realtime.persist(next);
  }

  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    setPast((history) => history.slice(0, -1));
    setFuture((history) => [items, ...history]);
    setItems(activeCutId, previous);
    realtime.broadcast(previous);
    void realtime.persist(previous);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture((history) => history.slice(1));
    setPast((history) => [...history, items]);
    setItems(activeCutId, next);
    realtime.broadcast(next);
    void realtime.persist(next);
  }

  function pointerDown(event: React.PointerEvent, item: StageItem) {
    if (item.lockedBy && item.lockedBy !== member.id) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(item.id);
    setPast((history) => [...history.slice(-29), items]);
    setFuture([]);
    dragRef.current = {
      id: item.id,
      offsetX: event.clientX - rect.left - (item.x / 100) * rect.width,
      offsetY: event.clientY - rect.top - (item.y / 100) * rect.height,
    };
    const locked = items.map((entry) => entry.id === item.id ? { ...entry, lockedBy: member.id } : entry);
    setItems(activeCutId, locked);
    realtime.broadcast(locked);
  }

  function pointerMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!drag || !rect) return;
    const draggedItem = items.find((item) => item.id === drag.id);
    const isBackground = draggedItem ? getAsset(draggedItem.assetId)?.category === "background" : false;
    const rawX = ((event.clientX - rect.left - drag.offsetX) / rect.width) * 100;
    const rawY = ((event.clientY - rect.top - drag.offsetY) / rect.height) * 100;
    const backgroundMin = draggedItem ? 100 - 50 * draggedItem.scale : 50;
    const backgroundMax = draggedItem ? 50 * draggedItem.scale : 50;
    const x = isBackground
      ? Math.min(backgroundMax, Math.max(backgroundMin, rawX))
      : Math.min(96, Math.max(4, rawX));
    const y = isBackground
      ? Math.min(backgroundMax, Math.max(backgroundMin, rawY))
      : Math.min(94, Math.max(6, rawY));
    setItems(activeCutId, items.map((item) => item.id === drag.id ? { ...item, x, y } : item));
  }

  function pointerUp() {
    if (!dragRef.current) return;
    const next = items.map((item) => item.id === dragRef.current?.id ? { ...item, lockedBy: undefined } : item);
    dragRef.current = null;
    setItems(activeCutId, next);
    realtime.broadcast(next);
    void realtime.persist(next);
  }

  const allConfirmed = team.scripts.every((cut) => team.stageConfirmed.includes(cut.id));

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">STEP 4 · 공동 무대 편집실</p>
          <h2 className="display-serif mt-2 text-4xl font-bold">촬영 전에, 장면을 먼저 세워 봐요</h2>
          <p className="mt-2 text-[var(--muted)]">고급 배경·인물·소품을 배치하며 배우 동선과 카메라 구도를 함께 정합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge"><span className="status-dot"/>{realtime.mode}</span>
          <div className="flex -space-x-2" aria-label="현재 접속자">
            {realtime.presence.map((person) => <span key={person.id} title={person.name} className="grid size-9 place-items-center rounded-full border-2 border-[var(--paper)] text-xs font-black text-white" style={{ background: person.color }}>{person.name.slice(-1)}</span>)}
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {team.scripts.map((cut) => (
          <button key={cut.id} className={`btn min-h-10 shrink-0 px-4 text-sm ${activeCutId === cut.id ? "btn-primary" : "btn-secondary"}`} onClick={() => { setActiveCutId(cut.id); setSelectedId(undefined); setPast([]); setFuture([]); }}>
            컷 {cut.order}{team.stageConfirmed.includes(cut.id) ? <Check size={14}/> : null}
          </button>
        ))}
      </div>

      <div className="mt-4 grid min-h-[640px] overflow-hidden rounded-[28px] border border-[var(--line)] bg-white lg:grid-cols-[250px_1fr_230px]">
        <aside className="scroll-soft max-h-[640px] overflow-y-auto border-b border-[var(--line)] p-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between"><strong>무대 요소</strong><span className="text-xs text-[var(--muted)]">눌러서 배치</span></div>
          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-1">
            {assets.map((stageAsset) => (
              <button key={stageAsset.id} type="button" className="focus-ring group flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white p-2 text-left transition hover:border-blue-300 hover:shadow-md" onClick={() => addAsset(stageAsset.id)}>
                <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  <Image src={stageAsset.filePath} alt="" fill unoptimized sizes="56px" className={stageAsset.category === "background" ? "object-cover" : "object-contain p-1"}/>
                </span>
                <span className="min-w-0"><strong className="block truncate text-sm">{stageAsset.title}</strong><small className="text-[var(--muted)]">{categoryNames[stageAsset.category]}</small></span>
              </button>
            ))}
          </div>
        </aside>

        <div className="relative bg-[#172033] p-3 md:p-5">
          <div className="mb-3 flex items-center justify-between text-xs text-white/65"><span>가로 촬영 화면 · 안전영역 안에 배치</span><span className="flex items-center gap-1"><Users size={13}/>{realtime.presence.length}명 접속</span></div>
          <div ref={boardRef} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} className="stage-grid relative mx-auto aspect-video w-full touch-none overflow-hidden rounded-2xl border-2 border-white/20 bg-slate-200 shadow-2xl">
            <div className="pointer-events-none absolute inset-[6%] z-[90] rounded-xl border border-dashed border-white/60"/>
            {items.length === 0 ? <div className="absolute inset-0 grid place-items-center text-center"><div><ImageIcon className="mx-auto text-slate-400" size={38}/><p className="mt-3 font-extrabold text-slate-600">왼쪽에서 배경과 요소를 놓아 보세요.</p><p className="mt-1 text-xs text-slate-500">실제 이미지로 촬영 구도를 미리 맞춥니다.</p></div></div> : null}
            {[...items].sort((a, b) => a.zIndex - b.zIndex).map((item) => {
              const stageAsset = getAsset(item.assetId);
              if (!stageAsset) return null;
              const isBackground = stageAsset.category === "background";
              const isCharacter = stageAsset.category === "character";
              const lockedByOther = item.lockedBy && item.lockedBy !== member.id;
              const poseScaleY = isCharacter && item.pose === "sitting" ? 0.76 : isCharacter && item.pose === "kneeling" ? 0.62 : 1;
              const poseLift = isCharacter && item.pose === "sitting" ? 12 : isCharacter && item.pose === "kneeling" ? 20 : 0;
              return (
                <button
                  type="button"
                  key={item.id}
                  onPointerDown={(event) => pointerDown(event, item)}
                  className={`absolute overflow-hidden border-2 shadow-xl ${isBackground ? "h-full w-full" : "aspect-square w-[20%] rounded-2xl"} ${selectedId === item.id ? "border-amber-300 ring-4 ring-amber-300/30" : "border-white/50"} ${lockedByOther ? "cursor-not-allowed opacity-75" : "cursor-grab active:cursor-grabbing"}`}
                  style={{
                    left: `${item.x}%`,
                    top: `${item.y}%`,
                    zIndex: item.zIndex,
                    transform: `translate(-50%, calc(-50% + ${poseLift}%)) rotate(${item.rotation}deg) scale(${isBackground ? item.scale : item.scale * 2.4}) scaleX(${item.facing === "left" ? -1 : 1}) scaleY(${poseScaleY})`,
                    transformOrigin: "center bottom",
                  }}
                  aria-label={`${stageAsset.title} 이동`}
                >
                  <Image src={stageAsset.filePath} alt="" fill unoptimized sizes={isBackground ? "900px" : "200px"} draggable={false} className={`pointer-events-none select-none ${isBackground ? "object-cover" : "object-contain"}`}/>
                  {lockedByOther ? <span className="absolute inset-0 grid place-items-center bg-slate-950/35 text-white"><LockKeyhole size={18}/></span> : null}
                  {!isBackground && selectedId === item.id ? <span className="absolute inset-x-1 bottom-1 rounded bg-slate-950/65 px-1 py-0.5 text-[9px] font-bold text-white">{stageAsset.title}</span> : null}
                  {isCharacter && item.pose && item.pose !== "standing" ? <span className="absolute left-1 top-1 rounded-full bg-amber-300 px-2 py-0.5 text-[9px] font-black text-slate-950">{item.pose === "sitting" ? "앉기" : "무릎"}</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="border-t border-[var(--line)] p-4 lg:border-l lg:border-t-0">
          <strong>선택 요소</strong>
          {selected && selectedAsset ? (
            <div className="mt-4">
              <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-slate-100">
                <div className="relative aspect-square"><Image src={selectedAsset.filePath} alt={selectedAsset.title} fill unoptimized sizes="200px" className={selectedAsset.category === "background" ? "object-cover" : "object-contain p-3"}/></div>
                <div className="bg-white p-3"><small className="text-[var(--muted)]">{categoryNames[selectedAsset.category]}</small><h3 className="mt-1 font-extrabold">{selectedAsset.title}</h3></div>
              </div>
              {selectedIsBackground ? <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-700">배경을 확대하면 무대 위에서 드래그해 원하는 촬영 구도로 옮길 수 있어요.</p> : null}
              {selectedAsset.category === "character" ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-black text-amber-900"><PersonStanding size={15}/> 촬영 자세 지시</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([['standing', '서기'], ['sitting', '앉기'], ['kneeling', '무릎']] as const).map(([pose, label]) => (
                      <button key={pose} type="button" className={`min-h-9 rounded-xl border px-2 text-xs font-black ${(selected.pose === pose || (!selected.pose && pose === 'standing')) ? 'border-amber-500 bg-amber-400 text-slate-950' : 'border-amber-200 bg-white text-amber-900'}`} onClick={() => updateSelected({ pose })}>{label}</button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-amber-800">무대판에 자세 표식을 남겨 실제 촬영 때 배우가 그대로 연기해요.</p>
                </div>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button className="btn btn-secondary min-h-10 px-2" onClick={() => updateSelectedScale(selected.scale - selectedScaleRange.step)}><Minus size={15}/> 축소</button>
                <button className="btn btn-secondary min-h-10 px-2" onClick={() => updateSelectedScale(selected.scale + selectedScaleRange.step)}><Plus size={15}/> 확대</button>
                {selectedIsBackground
                  ? <button className="btn btn-secondary min-h-10 px-2" onClick={() => updateSelected({ x: 50, y: 50, scale: 1 })}><ImageIcon size={15}/> 화면 맞춤</button>
                  : <button className="btn btn-secondary min-h-10 px-2" onClick={() => updateSelected({ facing: selected.facing === "left" ? "right" : "left" })}><FlipHorizontal2 size={15}/> 방향</button>}
                <button className="btn btn-secondary min-h-10 px-2" onClick={() => updateSelected({ zIndex: selected.zIndex + 1 })}><Layers size={15}/> 앞으로</button>
              </div>
              <button className="btn mt-2 min-h-10 w-full bg-red-50 text-red-700" onClick={removeSelected}><Trash2 size={15}/> 요소 빼기</button>
            </div>
          ) : <p className="mt-4 rounded-2xl bg-black/5 p-4 text-sm leading-6 text-[var(--muted)]">무대 위 요소를 누르면 크기·방향·레이어를 조절할 수 있어요.</p>}
          <div className="mt-6 flex gap-2"><button className="btn btn-secondary min-h-10 flex-1 px-2" disabled={!past.length} onClick={undo}><Undo2 size={15}/> 실행취소</button><button className="btn btn-secondary min-h-10 flex-1 px-2" disabled={!future.length} onClick={redo}><Redo2 size={15}/> 다시실행</button></div>
          <button className={`btn mt-4 w-full ${team.stageConfirmed.includes(activeCutId) ? "btn-teal" : "btn-primary"}`} onClick={() => confirmStage(activeCutId, !team.stageConfirmed.includes(activeCutId))}>{team.stageConfirmed.includes(activeCutId) ? <><Check size={17}/> 컷 설계 확정</> : "이 컷 설계 확정"}</button>
        </aside>
      </div>

      <div className="mt-7 flex justify-end"><button className="btn btn-primary" disabled={!allConfirmed} onClick={onNext}>음악 후보 모으기</button></div>
    </section>
  );
}
