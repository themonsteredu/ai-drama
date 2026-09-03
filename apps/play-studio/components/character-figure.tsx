import type { CharacterExpression, SavedCharacter } from "@moakit/stage-core";

interface CharacterFigureProps {
  character: SavedCharacter;
  facing?: "left" | "right";
  showName?: boolean;
}

function Eyes({ character }: { character: SavedCharacter }) {
  const { eyeStyle } = character.appearance;
  const expression = character.expression;
  const angry = expression === "angry";
  const sad = expression === "sad";

  if (eyeStyle === "smile" && expression !== "surprised") {
    return (
      <g fill="none" stroke="#2b211f" strokeLinecap="round" strokeWidth="5">
        <path d="M87 142 Q98 151 109 142" />
        <path d="M131 142 Q142 151 153 142" />
        {angry ? <><path d="M85 129 L108 136" /><path d="M132 136 L155 129" /></> : null}
        {sad ? <><path d="M85 134 Q97 128 109 134" /><path d="M131 134 Q143 128 155 134" /></> : null}
      </g>
    );
  }

  if (eyeStyle === "sparkle") {
    return (
      <g fill="#2b211f">
        <path d="M98 132 l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
        <path d="M142 132 l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
        {angry ? <><path d="M86 127 L108 135" stroke="#2b211f" strokeWidth="5"/><path d="M132 135 L154 127" stroke="#2b211f" strokeWidth="5"/></> : null}
      </g>
    );
  }

  return (
    <g>
      <ellipse cx="99" cy="143" rx={expression === "surprised" ? 8 : 6} ry={expression === "surprised" ? 10 : 8} fill="#2b211f" />
      <ellipse cx="141" cy="143" rx={expression === "surprised" ? 8 : 6} ry={expression === "surprised" ? 10 : 8} fill="#2b211f" />
      <circle cx="101" cy="140" r="2" fill="white" />
      <circle cx="143" cy="140" r="2" fill="white" />
      {angry ? <><path d="M85 128 L108 136" stroke="#2b211f" strokeLinecap="round" strokeWidth="5"/><path d="M132 136 L155 128" stroke="#2b211f" strokeLinecap="round" strokeWidth="5"/></> : null}
      {sad ? <><path d="M86 132 Q98 126 109 132" fill="none" stroke="#2b211f" strokeLinecap="round" strokeWidth="4"/><path d="M131 132 Q143 126 154 132" fill="none" stroke="#2b211f" strokeLinecap="round" strokeWidth="4"/></> : null}
    </g>
  );
}

function Mouth({ expression }: { expression: CharacterExpression }) {
  if (expression === "happy") return <path d="M101 164 Q120 183 139 164" fill="none" stroke="#9d3f4d" strokeLinecap="round" strokeWidth="6" />;
  if (expression === "sad") return <path d="M103 176 Q120 158 137 176" fill="none" stroke="#9d3f4d" strokeLinecap="round" strokeWidth="6" />;
  if (expression === "angry") return <path d="M105 170 L135 166" fill="none" stroke="#9d3f4d" strokeLinecap="round" strokeWidth="6" />;
  if (expression === "surprised") return <ellipse cx="120" cy="169" rx="9" ry="12" fill="#9d3f4d" />;
  return <path d="M108 169 Q120 174 132 169" fill="none" stroke="#9d3f4d" strokeLinecap="round" strokeWidth="5" />;
}

function HairBack({ character }: { character: SavedCharacter }) {
  const { hairStyle, hairColor } = character.appearance;
  if (hairStyle === "ponytail") {
    return <><ellipse cx="165" cy="112" rx="28" ry="38" fill={hairColor}/><circle cx="167" cy="87" r="13" fill={hairColor}/></>;
  }
  if (hairStyle === "bob") return <path d="M61 104 Q65 51 120 48 Q177 51 181 106 L174 185 Q150 201 120 199 Q89 201 66 185z" fill={hairColor} />;
  if (hairStyle === "curly") {
    return (
      <g fill={hairColor}>
        <circle cx="74" cy="91" r="27"/><circle cx="91" cy="68" r="28"/><circle cx="120" cy="61" r="30"/><circle cx="149" cy="68" r="28"/><circle cx="168" cy="93" r="27"/>
        <circle cx="71" cy="126" r="25"/><circle cx="169" cy="127" r="25"/>
      </g>
    );
  }
  return <path d="M63 114 Q64 52 120 49 Q176 52 178 113 Q159 82 120 85 Q83 82 63 114z" fill={hairColor} />;
}

function HairFront({ character }: { character: SavedCharacter }) {
  const { hairStyle, hairColor } = character.appearance;
  if (hairStyle === "curly") return <path d="M75 104 Q82 72 107 78 Q122 58 139 79 Q164 72 168 105 Q148 91 121 99 Q95 90 75 104z" fill={hairColor} />;
  if (hairStyle === "bob") return <><path d="M69 111 Q74 66 120 63 Q169 67 173 111 Q145 91 120 95 Q94 88 69 111z" fill={hairColor}/><path d="M70 118 Q77 142 73 176" fill="none" stroke={hairColor} strokeLinecap="round" strokeWidth="20"/><path d="M170 118 Q164 144 168 176" fill="none" stroke={hairColor} strokeLinecap="round" strokeWidth="20"/></>;
  if (hairStyle === "ponytail") return <path d="M66 111 Q70 57 120 54 Q172 57 175 111 Q151 84 120 91 Q93 83 66 111z" fill={hairColor} />;
  return <path d="M67 111 Q70 57 120 54 Q171 59 174 109 Q151 83 119 91 Q91 84 67 111z" fill={hairColor} />;
}

function Accessory({ character }: { character: SavedCharacter }) {
  const { accessory, hairColor } = character.appearance;
  if (accessory === "glasses") {
    return <g fill="none" stroke="#26324a" strokeWidth="4"><rect x="80" y="132" width="36" height="25" rx="10"/><rect x="124" y="132" width="36" height="25" rx="10"/><path d="M116 143 H124"/><path d="M80 140 L68 136"/><path d="M160 140 L172 136"/></g>;
  }
  if (accessory === "hair-bow") {
    return <g transform="translate(153 73)"><path d="M0 8 Q-24 -5 -20 20 Q-8 25 0 14" fill="#f35f78"/><path d="M8 8 Q32 -5 28 20 Q16 25 8 14" fill="#f35f78"/><circle cx="4" cy="11" r="8" fill="#d93f5a"/></g>;
  }
  if (accessory === "cap") {
    return <g><path d="M66 91 Q83 43 124 45 Q164 47 177 91z" fill="#f1b542"/><path d="M119 88 Q163 78 190 96 Q160 105 124 100z" fill="#d59626"/><path d="M84 70 Q118 56 153 71" fill="none" stroke={hairColor} strokeOpacity=".18" strokeWidth="3"/></g>;
  }
  return null;
}

export function CharacterFigure({ character, facing = "right", showName = false }: CharacterFigureProps) {
  const { appearance, pose } = character;
  const sitting = pose === "sitting";
  const waving = pose === "waving";
  const pointing = pose === "pointing";

  return (
    <figure className="character-figure" aria-label={`${character.name} 캐릭터`}>
      <svg viewBox="0 0 240 360" role="img" aria-hidden="true">
        <g transform={facing === "left" ? "translate(240 0) scale(-1 1)" : undefined}>
          <ellipse cx="120" cy="335" rx="67" ry="15" fill="rgba(31,41,55,.15)" />
          <HairBack character={character} />

          {sitting ? (
            <g fill="none" stroke={appearance.bottomColor} strokeLinecap="round" strokeWidth="25">
              <path d="M101 278 Q79 300 68 329" />
              <path d="M139 278 Q160 299 174 329" />
            </g>
          ) : (
            <g fill="none" stroke={appearance.bottomColor} strokeLinecap="round" strokeWidth="25">
              <path d="M101 271 L94 326" />
              <path d="M139 271 L147 326" />
            </g>
          )}
          <g fill="none" stroke="#2f3542" strokeLinecap="round" strokeWidth="13">
            <path d={sitting ? "M65 330 L91 333" : "M82 331 L103 331"} />
            <path d={sitting ? "M171 330 L193 333" : "M137 331 L158 331"} />
          </g>

          <path d="M84 211 Q120 191 156 211 L151 278 Q120 291 89 278z" fill={appearance.topColor} />
          <path d="M93 267 Q120 279 147 267 L151 284 Q121 297 88 283z" fill={appearance.bottomColor} />
          <path d="M111 194 H129 V212 H111z" fill={appearance.skinTone} />

          <g fill="none" stroke={appearance.skinTone} strokeLinecap="round" strokeWidth="20">
            <path d="M90 218 Q69 243 63 272" />
            {waving ? <path d="M150 218 Q175 192 171 153" /> : pointing ? <path d="M151 219 Q183 222 205 205" /> : <path d="M151 218 Q171 246 178 272" />}
          </g>
          {waving ? <g fill="none" stroke={appearance.skinTone} strokeLinecap="round" strokeWidth="9"><path d="M166 154 L161 137"/><path d="M172 154 L172 134"/><path d="M178 157 L183 139"/></g> : null}
          {pointing ? <path d="M202 205 L220 198" fill="none" stroke={appearance.skinTone} strokeLinecap="round" strokeWidth="9"/> : null}

          <circle cx="67" cy="138" r="14" fill={appearance.skinTone} />
          <circle cx="173" cy="138" r="14" fill={appearance.skinTone} />
          <ellipse cx="120" cy="132" rx="55" ry="67" fill={appearance.skinTone} />
          <HairFront character={character} />
          <Eyes character={character} />
          <path d="M119 146 Q113 156 120 158" fill="none" stroke="#b87562" strokeLinecap="round" strokeWidth="3" />
          <Mouth expression={character.expression} />
          {character.expression === "thinking" ? <g fill="#ffffff" stroke="#57627a" strokeWidth="2"><circle cx="181" cy="129" r="6"/><circle cx="192" cy="116" r="9"/><ellipse cx="212" cy="93" rx="18" ry="13"/></g> : null}
          <Accessory character={character} />
        </g>
      </svg>
      {showName ? <figcaption>{character.name}</figcaption> : null}
    </figure>
  );
}
