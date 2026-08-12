"use client";

import { Check, ChevronRight } from "lucide-react";

export const STUDIO_STEPS = [
  { id: "work", label: "작품선택" },
  { id: "roles", label: "역할배정" },
  { id: "script", label: "시나리오" },
  { id: "stage", label: "무대꾸미기" },
  { id: "music", label: "음악" },
  { id: "recording", label: "촬영" },
  { id: "finish", label: "작품완성" },
] as const;

export type StudioStep = (typeof STUDIO_STEPS)[number]["id"];

export function StepNav({ active, onChange, maxIndex }: { active: StudioStep; onChange: (step: StudioStep) => void; maxIndex: number }) {
  const activeIndex = STUDIO_STEPS.findIndex((step) => step.id === active);
  return <nav aria-label="제작 단계" className="scroll-soft overflow-x-auto"><ol className="flex min-w-max items-center gap-1 p-1">{STUDIO_STEPS.map((step, index) => <li key={step.id} className="flex items-center"><button type="button" disabled={index > maxIndex} onClick={() => onChange(step.id)} aria-current={active === step.id ? "step" : undefined} className={`focus-ring flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-bold transition ${active === step.id ? "bg-[var(--wine)] text-white" : index < activeIndex ? "text-[var(--teal)]" : "text-[var(--muted)] hover:bg-black/5"}`}><span className={`grid size-5 place-items-center rounded-full text-[10px] ${active === step.id ? "bg-white/20" : index < activeIndex ? "bg-[var(--teal)] text-white" : "bg-black/5"}`}>{index < activeIndex ? <Check size={12}/> : index + 1}</span>{step.label}</button>{index < STUDIO_STEPS.length - 1 ? <ChevronRight className="mx-1 text-black/15" size={14}/> : null}</li>)}</ol></nav>;
}
