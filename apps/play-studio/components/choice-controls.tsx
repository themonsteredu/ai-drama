"use client";

import type { ReactNode } from "react";
import type { Choice } from "@/lib/catalog";

export function ChoiceSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="choice-section"><strong>{title}</strong>{children}</section>;
}

export function Swatches({ values, value, onChange }: { values: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="swatches">
      {values.map((color) => <button type="button" aria-label={`${color} 색상`} key={color} className={value === color ? "active" : ""} style={{ background: color }} onClick={() => onChange(color)} />)}
    </div>
  );
}

export function ChoiceButtons<T extends string>({ choices, value, onChange }: { choices: Choice<T>[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className="choice-buttons">
      {choices.map((choice) => <button type="button" key={choice.id} className={value === choice.id ? "active" : ""} onClick={() => onChange(choice.id)}>{choice.label}</button>)}
    </div>
  );
}
