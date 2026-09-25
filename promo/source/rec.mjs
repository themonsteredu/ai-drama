import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const FF = process.env.FFMPEG || '/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2';
const DPR = Number(process.env.DPR || 1);
const BASE = process.env.BASE || 'http://localhost:3000';
// 앱 웹폰트 대신 Pretendard로 한글을 깔끔하게 + 마우스 위치를 보여주는 작은 커서 표시
const FONT = `*{font-family:"Pretendard","S-Core Dream",sans-serif !important}
#promo-cursor{position:fixed;z-index:2147483647;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(244,165,34,.35);border:2.5px solid #f4a522;pointer-events:none;transition:transform .12s;left:-100px;top:-100px}
#promo-cursor.down{transform:scale(.7);background:rgba(244,165,34,.7)}`;
export async function session(fn, opts = {}) {
  const b = await chromium.launch({ args: [] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: DPR, ...opts });
  await ctx.addInitScript(css => { document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    const c = document.createElement('div'); c.id = 'promo-cursor'; document.body.appendChild(c);
    addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('pointermove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => c.classList.add('down'), true);
    addEventListener('mouseup', () => c.classList.remove('down'), true);
  }); }, FONT);
  const page = await ctx.newPage();
  try { await fn(page); } finally { await b.close(); }
}
export async function record(page, name, actions) {
  const dir = `clips/${name}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async f => {
    const i = frames.length; frames.push(f.metadata.timestamp);
    fs.writeFileSync(`${dir}/${String(i).padStart(5,'0')}.jpg`, Buffer.from(f.data, 'base64'));
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1600*DPR, maxHeight: 900*DPR, everyNthFrame: 1 });
  const start = Date.now() / 1000;
  await actions();
  const end = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  // 프레임 타임스탬프 -> 일정한 30fps 영상
  let list = '';
  frames.forEach((t, i) => { const next = i + 1 < frames.length ? frames[i + 1] : end; list += `file '${String(i).padStart(5,'0')}.jpg'\nduration ${Math.max(0.001, next - t).toFixed(4)}\n`; });
  list += `file '${String(frames.length - 1).padStart(5,'0')}.jpg'\n`;
  fs.writeFileSync(`${dir}/list.txt`, list);
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`, '-vf', `fps=30,scale=${1600*DPR}:${900*DPR}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', `clips/${name}.mp4`]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(name, frames.length, 'frames', (end - start).toFixed(1), 's');
}
export { BASE };
