import { chromium } from 'playwright';
import fs from 'node:fs';
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('file://' + process.cwd() + '/compose.html');
await p.evaluate(() => document.fonts.ready);
const total = await p.evaluate(() => window.TOTAL);
const mode = process.argv[2];
if (mode === 'test') {
  for (const t of process.argv.slice(3).map(Number)) { await p.evaluate(t => window.render(t), t); await p.screenshot({ path: `shots/c-${t}.jpg`, quality: 80, type: 'jpeg' }); }
} else {
  // 사용법: node render.mjs full [시작프레임] [끝프레임]  (구간을 나눠 동시에 돌릴 수 있음)
  fs.mkdirSync('out', { recursive: true });
  const n = Math.round(total * 30);
  const a = Number(process.argv[3] || 0), z = Math.min(n, Number(process.argv[4] || n));
  for (let i = a; i < z; i++) {
    await p.evaluate(t => window.render(t), i / 30);
    await p.screenshot({ path: `out/${String(i).padStart(5,'0')}.jpg`, type: 'jpeg', quality: 95 });
    if (i % 150 === 0) console.log(i, '/', n);
  }
}
console.log('total', total);
await b.close();
