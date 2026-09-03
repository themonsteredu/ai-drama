"use client";

import type { CharacterAppearance, SavedCharacter } from "@moakit/stage-core";
import { CharacterFigure } from "@/components/character-figure";
import { ChoiceButtons, ChoiceSection, Swatches } from "@/components/choice-controls";
import {
  accessories,
  bottomColors,
  expressions,
  eyeStyles,
  hairColors,
  hairStyles,
  poses,
  skinTones,
  topColors,
} from "@/lib/catalog";

interface CharacterPanelProps {
  draft: SavedCharacter;
  cast: SavedCharacter[];
  onDraftChange: (character: SavedCharacter) => void;
  onSave: () => void;
  onSaveAndPlace: () => void;
  onPlace: (character: SavedCharacter) => void;
}

export function CharacterPanel({ draft, cast, onDraftChange, onSave, onSaveAndPlace, onPlace }: CharacterPanelProps) {
  function patchAppearance(patch: Partial<CharacterAppearance>) {
    onDraftChange({ ...draft, appearance: { ...draft.appearance, ...patch } });
  }

  return (
    <div className="character-panel">
      <div className="builder-preview">
        <CharacterFigure character={draft} showName />
      </div>
      <label className="field-label">배우 이름<input value={draft.name} maxLength={12} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} /></label>

      <ChoiceSection title="피부색">
        <Swatches values={skinTones} value={draft.appearance.skinTone} onChange={(skinTone) => patchAppearance({ skinTone })} />
      </ChoiceSection>
      <ChoiceSection title="머리 모양">
        <ChoiceButtons choices={hairStyles} value={draft.appearance.hairStyle} onChange={(hairStyle) => patchAppearance({ hairStyle })} />
      </ChoiceSection>
      <ChoiceSection title="머리색">
        <Swatches values={hairColors} value={draft.appearance.hairColor} onChange={(hairColor) => patchAppearance({ hairColor })} />
      </ChoiceSection>
      <ChoiceSection title="눈 모양">
        <ChoiceButtons choices={eyeStyles} value={draft.appearance.eyeStyle} onChange={(eyeStyle) => patchAppearance({ eyeStyle })} />
      </ChoiceSection>
      <ChoiceSection title="상의 색">
        <Swatches values={topColors} value={draft.appearance.topColor} onChange={(topColor) => patchAppearance({ topColor })} />
      </ChoiceSection>
      <ChoiceSection title="하의 색">
        <Swatches values={bottomColors} value={draft.appearance.bottomColor} onChange={(bottomColor) => patchAppearance({ bottomColor })} />
      </ChoiceSection>
      <ChoiceSection title="표정">
        <ChoiceButtons choices={expressions} value={draft.expression} onChange={(expression) => onDraftChange({ ...draft, expression })} />
      </ChoiceSection>
      <ChoiceSection title="동작">
        <ChoiceButtons choices={poses} value={draft.pose} onChange={(pose) => onDraftChange({ ...draft, pose })} />
      </ChoiceSection>
      <ChoiceSection title="장식">
        <ChoiceButtons choices={accessories} value={draft.appearance.accessory} onChange={(accessory) => patchAppearance({ accessory })} />
      </ChoiceSection>

      <div className="builder-actions">
        <button type="button" className="secondary-button" onClick={onSave}>내 배우로 저장</button>
        <button type="button" className="primary-button" onClick={onSaveAndPlace}>저장하고 무대에 놓기</button>
      </div>

      <div className="cast-library">
        <div><strong>내 배우 보관함</strong><span>{cast.length}명</span></div>
        <div className="cast-row">
          {cast.map((character) => (
            <button type="button" key={character.id} onClick={() => onPlace(character)} title={`${character.name} 무대에 놓기`}>
              <CharacterFigure character={character} />
              <span>{character.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
