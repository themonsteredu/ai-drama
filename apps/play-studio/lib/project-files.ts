import type { StageProject } from '@moakit/stage-core';

export const STORAGE_KEY = 'moakit-play-project-v1';
export const MAX_FILE_BYTES = 2_000_000;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
const finite = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const oneOf = (v: unknown, values: string[]) => typeof v === 'string' && values.includes(v);
const color = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
function character(v: unknown): boolean {
  if (!record(v) || !text(v.id, 150) || !text(v.name, 80) || !record(v.appearance)) return false;
  const a = v.appearance;
  return ['skinTone','hairColor','topColor','bottomColor'].every(k => color(a[k]))
    && oneOf(a.hairStyle, ['short','bob','curly','ponytail'])
    && oneOf(a.eyeStyle, ['round','smile','sparkle'])
    && oneOf(a.accessory, ['none','glasses','hair-bow','cap'])
    && oneOf(v.expression, ['happy','sad','angry','surprised','thinking'])
    && oneOf(v.pose, ['standing','waving','pointing','sitting']);
}
function uniqueIds(values: unknown[]): boolean {
  const ids = values.map(v => record(v) ? v.id : undefined);
  return ids.every(id => typeof id === 'string' && id.length > 0) && new Set(ids).size === ids.length;
}
/** Validate all nested values before either localStorage hydration or file import. */
export function validateProject(v: unknown): v is StageProject {
  if (!record(v) || v.version !== 1 || !text(v.id,150) || !text(v.title,200) || !text(v.updatedAt,80)) return false;
  if (!Array.isArray(v.cast) || v.cast.length > 100 || !v.cast.every(character) || !uniqueIds(v.cast)) return false;
  if (!Array.isArray(v.scenes) || v.scenes.length < 1 || v.scenes.length > 6 || !uniqueIds(v.scenes)) return false;
  if (!v.scenes.some(s => record(s) && s.id === v.activeSceneId)) return false;
  return v.scenes.every(s => {
    if (!record(s) || !text(s.id,150) || !text(s.title,200) || !oneOf(s.backgroundId,['classroom','forest','space','castle','beach','blank'])) return false;
    if (!Array.isArray(s.items) || s.items.length > 200 || !uniqueIds(s.items)) return false;
    return s.items.every(item => {
      if (!record(item) || !text(item.id,150) || !record(item.data)) return false;
      if (!finite(item.x,0,100) || !finite(item.y,0,100) || !finite(item.scale,0.1,5) || !finite(item.rotation,-360,360) || !finite(item.zIndex,0,10000)) return false;
      const d = item.data;
      if (item.kind === 'character') return character(d) && oneOf(d.facing,['left','right']);
      if (item.kind === 'prop') return text(d.catalogId,80) && text(d.label,100) && text(d.symbol,100);
      if (item.kind === 'speech') return text(d.text,1000) && oneOf(d.variant,['speech','thought','caption']);
      return false;
    });
  });
}
export function parseProject(raw: string): StageProject {
  if (new Blob([raw]).size > MAX_FILE_BYTES) throw new Error('작품 파일은 2MB 이하만 불러올 수 있어요.');
  let v: unknown;
  try { v = JSON.parse(raw); } catch { throw new Error('읽을 수 없는 작품 파일입니다. 원래 파일은 그대로 두었어요.'); }
  if (!validateProject(v)) throw new Error('MOAKIT PLAY 작품 형식이 아니거나 일부 내용이 손상되었어요.');
  return v;
}
export function fileName(title: string): string {
  return (title.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').trim().slice(0,60) || 'MOAKIT-PLAY');
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  // Delayed revoke is important for mobile Safari's download hand-off.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
