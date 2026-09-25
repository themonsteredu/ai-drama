import { session, record, BASE } from './rec.mjs';
const w = ms => new Promise(r => setTimeout(r, ms));
const which = process.argv[2];
const HD = process.env.DPR === '2' ? '_hd' : '';
// 부드러운 마우스 이동 후 클릭
async function glide(p, loc, { click = true, dx = 0.5, dy = 0.5 } = {}) {
  const b = await loc.boundingBox();
  const x = b.x + b.width * dx, y = b.y + b.height * dy;
  await p.mouse.move(x, y, { steps: 18 }); await w(180);
  if (click) { await p.mouse.down(); await w(90); await p.mouse.up(); }
}
async function join(p, code, name) {
  await p.goto(BASE + '/student'); await w(900);
  await p.fill('#team-code', code); await p.fill('#student-name', name);
  await p.getByRole('button', { name: '제작 스튜디오 입장' }).click(); await w(2200);
}
const step = (p, label) => p.locator('nav[aria-label="제작 단계"] button', { hasText: label });
const scrollTo = (p, y) => p.evaluate(y => window.scrollTo({ top: y, behavior: 'smooth' }), y);

await session(async p => {
  await p.goto(BASE + '/'); await p.evaluate(() => localStorage.clear()); await w(500);
  await p.mouse.move(800, 450);
  if (which === 'home') {
    await p.goto(BASE + '/'); await w(2000);
    await record(p, 'home', async () => { await w(2500); await scrollTo(p, 760); await w(4200); });
  }
  if (which === 'work') {
    await join(p, 'MOON24', '민서');
    await step(p, '작품선택').click(); await w(1500);
    await record(p, 'work' + HD, async () => {
      await w(800);
      await glide(p, p.locator('main button', { hasText: '흥부전' }).first(), { click: false }); await w(900);
      await glide(p, p.locator('main button', { hasText: '별주부전' }).first(), { click: false }); await w(900);
      await glide(p, p.locator('main button', { hasText: '춘향전' }).first()); await w(1200);
      await glide(p, p.getByRole('button', { name: '이 작품으로 역할 배정' }), { click: false }); await w(1500);
    });
  }
  if (which === 'roles') {
    await join(p, 'MOON24', '민서');
    await step(p, '역할배정').click(); await w(1500);
    await record(p, 'roles' + HD, async () => {
      await w(1200);
      await scrollTo(p, 700); await w(2600);
      await scrollTo(p, 1150); await w(3200);
    });
  }
  if (which === 'script') {
    await join(p, 'MOON24', '민서');
    await scrollTo(p, 560); await w(1500);
    const ta = p.locator('main textarea').nth(1);
    await ta.fill(''); await w(300);
    await record(p, 'script' + HD, async () => {
      await w(700);
      await glide(p, ta); await w(300);
      await p.keyboard.type('마음과 절개는 힘으로 꺾을 수 없습니다.', { delay: 110 }); await w(1200);
      await glide(p, p.getByRole('button', { name: /교사용 모범대사/ })); await w(2600);
    });
  }
  if (which === 'stage') {
    await join(p, 'WAVE55', '하린');
    const board = p.locator('.stage-grid');
    const top = await p.evaluate(() => document.querySelector('.stage-grid').getBoundingClientRect().top + scrollY);
    await p.evaluate(y => window.scrollTo(0, y), top - 190); await w(1200);
    await record(p, 'stage' + HD, async () => {
      await w(600);
      await glide(p, p.getByRole('button', { name: /용궁 왕좌실/ }).first()); await w(1100);
      await glide(p, p.getByRole('button', { name: /토끼/ }).first()); await w(700);
      let bb = await board.boundingBox();
      await p.mouse.move(bb.x + bb.width * .5, bb.y + bb.height * .5, { steps: 12 }); await w(200);
      await p.mouse.down(); await p.mouse.move(bb.x + bb.width * .3, bb.y + bb.height * .56, { steps: 22 }); await p.mouse.up(); await w(600);
      await glide(p, p.getByRole('button', { name: /별주부/ }).first()); await w(700);
      await p.mouse.move(bb.x + bb.width * .5, bb.y + bb.height * .5, { steps: 12 }); await w(200);
      await p.mouse.down(); await p.mouse.move(bb.x + bb.width * .7, bb.y + bb.height * .56, { steps: 22 }); await p.mouse.up(); await w(600);
      await glide(p, p.getByRole('button', { name: /확대/ })); await w(500);
      await glide(p, p.getByRole('button', { name: /확대/ })); await w(900);
      await glide(p, p.getByRole('button', { name: /^앉기$/ })); await w(1500);
    });
  }
  if (which === 'rec') {
    await join(p, 'STAR66', '예준');
    await scrollTo(p, 160); await w(1400);
    await record(p, 'rec' + HD, async () => {
      await w(700);
      await glide(p, p.locator('main button', { hasText: '차가운 거절' })); await w(1300);
      await glide(p, p.locator('main button', { hasText: '갈등 폭발' })); await w(1300);
      await glide(p, p.locator('main button', { hasText: '한 됫박의 선택' })); await w(1300);
      await glide(p, p.getByRole('button', { name: /카메라 준비/ }), { click: false }); await w(1500);
    });
  }
  if (which === 'finish') {
    await join(p, 'STAR66', '예준');
    await step(p, '작품완성').click(); await w(1500);
    await record(p, 'finish' + HD, async () => { await w(1000); await scrollTo(p, 200); await w(4500); });
  }
  if (which === 'teacher') {
    await p.goto(BASE + '/teacher'); await w(1500);
    await record(p, 'teacher' + HD, async () => {
      await w(700);
      await glide(p, p.locator('main button[type=submit], form button').first()); await w(2600);
      await glide(p, p.locator('main').getByText('STAR66').first(), { click: false }); await w(1000);
      await glide(p, p.getByText('전체 작품 상영').first(), { click: false }); await w(1800);
    });
  }
  if (which === 'sheet') {
    await p.goto(BASE + '/worksheet/chunhyang/4'); await w(2000);
    await record(p, 'sheet', async () => { await w(1200); await scrollTo(p, 900); await w(3500); });
  }
});
