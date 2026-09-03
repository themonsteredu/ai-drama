"use client";

import type { CharacterExpression, CharacterPose, SpeechVariant, StageItem } from "@moakit/stage-core";
import { ChoiceButtons, ChoiceSection } from "@/components/choice-controls";
import { expressions, poses, speechVariants } from "@/lib/catalog";

interface InspectorProps {
  item?: StageItem;
  onScale: (delta: number) => void;
  onRotate: (delta: number) => void;
  onLayer: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCharacterChange: (patch: { expression?: CharacterExpression; pose?: CharacterPose; facing?: "left" | "right" }) => void;
  onSpeechChange: (patch: { text?: string; variant?: SpeechVariant }, record?: boolean) => void;
}

export function Inspector({ item, onScale, onRotate, onLayer, onDuplicate, onDelete, onCharacterChange, onSpeechChange }: InspectorProps) {
  return (
    <aside className="inspector-panel">
      <div className="panel-heading"><p>선택한 요소</p><span>{item ? "편집 가능" : "선택 없음"}</span></div>
      {!item ? (
        <div className="inspector-empty">
          <span>↖</span>
          <strong>무대의 요소를 눌러 보세요.</strong>
          <p>크기, 방향, 표정, 대사를 여기에서 바꿀 수 있어요.</p>
        </div>
      ) : (
        <div className="inspector-scroll">
          <div className="selected-summary">
            <span>{item.kind === "character" ? "☺" : item.kind === "prop" ? item.data.symbol : "▰"}</span>
            <div><small>{item.kind === "character" ? "CHARACTER" : item.kind === "prop" ? "PROP" : "DIALOGUE"}</small><strong>{item.kind === "character" ? item.data.name : item.kind === "prop" ? item.data.label : "대사·설명"}</strong></div>
          </div>

          {item.kind === "character" ? (
            <>
              <ChoiceSection title="표정 바꾸기"><ChoiceButtons choices={expressions} value={item.data.expression} onChange={(expression) => onCharacterChange({ expression })} /></ChoiceSection>
              <ChoiceSection title="동작 바꾸기"><ChoiceButtons choices={poses} value={item.data.pose} onChange={(pose) => onCharacterChange({ pose })} /></ChoiceSection>
              <ChoiceSection title="바라보는 방향">
                <div className="two-buttons"><button type="button" className={item.data.facing === "left" ? "active" : ""} onClick={() => onCharacterChange({ facing: "left" })}>← 왼쪽</button><button type="button" className={item.data.facing === "right" ? "active" : ""} onClick={() => onCharacterChange({ facing: "right" })}>오른쪽 →</button></div>
              </ChoiceSection>
            </>
          ) : null}

          {item.kind === "speech" ? (
            <>
              <label className="field-label">대사 또는 설명<textarea value={item.data.text} maxLength={120} onChange={(event) => onSpeechChange({ text: event.target.value }, false)} /></label>
              <ChoiceSection title="모양"><ChoiceButtons choices={speechVariants} value={item.data.variant} onChange={(variant) => onSpeechChange({ variant })} /></ChoiceSection>
            </>
          ) : null}

          <ChoiceSection title="크기">
            <div className="two-buttons"><button type="button" onClick={() => onScale(-0.1)}>－ 작게</button><button type="button" onClick={() => onScale(0.1)}>＋ 크게</button></div>
          </ChoiceSection>
          <ChoiceSection title="기울기">
            <div className="two-buttons"><button type="button" onClick={() => onRotate(-5)}>↶ 왼쪽</button><button type="button" onClick={() => onRotate(5)}>↷ 오른쪽</button></div>
          </ChoiceSection>
          <ChoiceSection title="앞뒤 순서">
            <div className="two-buttons"><button type="button" onClick={() => onLayer(-1)}>뒤로</button><button type="button" onClick={() => onLayer(1)}>앞으로</button></div>
          </ChoiceSection>
          <div className="inspector-actions">
            <button type="button" onClick={onDuplicate}>복사하기</button>
            <button type="button" className="danger" onClick={onDelete}>무대에서 빼기</button>
          </div>
        </div>
      )}
    </aside>
  );
}
