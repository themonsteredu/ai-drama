export type BackgroundStrength='gentle'|'clear';
export const backgroundPresets=[
 {name:'밝은 낮',prompt:'이 그림을 그린 아이가 이어서 그린 것처럼 배경에 나무·꽃·구름 등 어울리는 풍경을 더해 주세요. 원래 그림의 선 굵기, 삐뚤빼뚤한 선, 색칠한 자국과 종이 질감을 그대로 따르세요. 밝은 낮의 색으로 꾸미되 전문 삽화처럼 매끈하게 다시 그리지 마세요.'},
 {name:'노을 풍경',prompt:'이 그림을 그린 아이가 같은 도구로 그린 것처럼 배경에 주황빛·분홍빛 노을을 넣어 주세요. 원래 그림의 단순한 형태와 선, 색칠 자국을 그대로 따르세요. 사실적인 빛·그림자나 매끈한 그라데이션은 넣지 마세요.'},
 {name:'달빛 밤',prompt:'이 그림을 그린 아이가 같은 도구로 그린 것처럼 배경을 푸른 밤으로 꾸며 주세요. 하늘이 보이면 아이의 선과 채색 방식으로 달과 별을 더해 주세요. 원래 색칠 자국과 종이 질감을 유지하고 반짝이는 디지털 효과는 넣지 마세요.'},
] as const;

const originalStyle=`The uploaded drawing is the ONLY style reference. Match this specific child's drawing ability and materials: the same wobbly outlines, line thickness, simple shapes, uneven coloring, pencil/crayon/marker strokes, paper grain and uncolored gaps where present. New scenery must look drawn by the SAME CHILD using the SAME TOOLS. Do not improve the drawing skill, clean up lines, smooth the coloring, or replace it with a generic storybook illustration, vector art, 3D, photorealism, polished painting, realistic shadows or digital gradients. Change background CONTENT, never the artist's style. This style constraint also applies to the requested background direction.`;

export function backgroundEditPrompt(prompt:string,operation:unknown,strength:BackgroundStrength='clear'){
 if(operation==='remove-character')return `Remove ONLY the selected character inside the transparent mask. Reconstruct the hidden background naturally. ${originalStyle} No person, creature, silhouette, shadow or duplicate may remain in the selected region. Keep all unmasked pixels, other characters, composition and letterboxing unchanged. Context: ${prompt.trim()}`;
 const change=strength==='gentle'
  ?'Gently enrich the background with a few simple scenery additions and colors while retaining the existing background layout.'
  :'Make a clearly visible transformation of the background CONTENT: add recognizable scenery or change the time-of-day colors according to the requested setting, at the same simplicity and level of detail as the child\'s drawing. The change should be visible at thumbnail size through new background content, not through a different rendering style.';
 return `Edit ONLY the transparent-mask background inside this child's illustration. ${originalStyle} ${change} Preserve opaque protected characters, their exact appearance, size and positions, camera framing, the ground under their feet and outer letterboxing. Do not add people, animals, text or logos. Never redraw a protected character. Background direction: ${prompt.trim()}`;
}
