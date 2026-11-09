export type BackgroundStrength='gentle'|'clear';
export const backgroundPresets=[
 {name:'밝은 동화풍',prompt:'배경을 밝고 풍성한 동화 속 풍경으로 꾸며 주세요. 햇살과 부드러운 그림자를 더하고, 원래 장소에 어울리는 나무·꽃·소품과 먼 풍경을 채워 깊이감을 만들어 주세요. 아이가 그린 선과 채색 느낌은 살려 주세요.'},
 {name:'노을 풍경',prompt:'배경을 주황빛과 분홍빛 노을이 퍼지는 풍경으로 바꿔 주세요. 따뜻한 빛과 긴 그림자, 멀리 보이는 풍경과 장소에 어울리는 소품을 더해 주세요. 아이가 그린 선과 채색 느낌은 살려 주세요.'},
 {name:'달빛 밤',prompt:'배경을 푸른 달빛이 비치는 밤 풍경으로 바꿔 주세요. 하늘이 보이면 달과 별을 넣고, 장소에 어울리는 작은 불빛과 멀리 보이는 풍경을 더해 주세요. 아이가 그린 선과 채색 느낌은 살려 주세요.'},
] as const;

export function backgroundEditPrompt(prompt:string,operation:unknown,strength:BackgroundStrength='clear'){
 if(operation==='remove-character')return `Remove ONLY the selected character inside the transparent mask. Reconstruct the hidden background naturally in the same handmade drawing style. No person, creature, silhouette, shadow or duplicate may remain in the selected region. Keep all unmasked pixels, other characters, composition and letterboxing unchanged. Context: ${prompt.trim()}`;
 const change=strength==='gentle'
  ?'Gently enrich the background colors, lighting and scenery while retaining the existing background layout.'
  :'Make a clearly visible transformation of the background: use a distinct color palette and lighting, enrich scenery with relevant environmental details, foreground and distant layers. The change must be obvious at thumbnail size, not just a slight color correction. You may redesign background details and arrangement to match the requested setting.';
 return `Edit ONLY the transparent-mask background inside this child's illustration. ${change} Keep the handmade drawing style coherent. Preserve opaque protected characters, their exact appearance, size and positions, camera framing, the ground under their feet and outer letterboxing. Do not add people, animals, text or logos. Never redraw a protected character. Background direction: ${prompt.trim()}`;
}
