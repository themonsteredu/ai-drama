import assert from 'node:assert/strict';

// Exercise the real encoder and editor, with a tone instead of a physical microphone.
export async function checkSceneRecording(page, url) {
  await page.addInitScript(() => {
    const devices = Object.getPrototypeOf(navigator.mediaDevices);
    devices.getUserMedia = async () => {
      const context = new AudioContext();
      await context.resume();
      const tone = context.createOscillator();
      const output = context.createMediaStreamDestination();
      tone.connect(output);
      tone.start();
      window.testMicTrack = output.stream.getAudioTracks()[0];
      window.testMicContext = context;
      return output.stream;
    };
  });
  await page.goto(url, {waitUntil: 'domcontentloaded'});
  const panel = page.getByRole('region', {name: '장면별 대사와 자동 전환'});
  const record = panel.getByRole('button', {name: '직접 녹음', exact: true});
  const finish = panel.getByRole('button', {name: /녹음 완료/});
  const listen = panel.getByRole('button', {name: '이 장면 대사 듣기'});
  for (const automatic of [false, true]) {
    await record.click();
    await finish.waitFor();
    const started = Date.now();
    if (!automatic) {
      await page.waitForTimeout(1150);
      await finish.click();
    }
    await record.waitFor({timeout: 25000});
    if (automatic) assert(Date.now() - started >= 18500, 'a full take should stop at the time limit');
    await listen.waitFor();
    assert.equal(await page.evaluate(() => window.testMicTrack.readyState), 'ended');
    await page.evaluate(() => window.testMicContext.close());
    await page.locator('.draw-title small').filter({hasText:'이 기기에 저장됨'}).waitFor();
    const take = await page.evaluate(async () => {
      const db = await new Promise(resolve => {
        const open = indexedDB.open('moakit-play-drawings-v1');
        open.onsuccess = () => resolve(open.result);
      });
      const project = await new Promise(resolve => {
        const get = db.transaction('projects').objectStore('projects').get('active');
        get.onsuccess = () => resolve(get.result);
      });
      db.close();
      const voice = project.scenes.find(scene => scene.id === project.activeSceneId).voice;
      const context = new OfflineAudioContext(1, 1, 16000);
      const buffer = await context.decodeAudioData(await (await fetch(voice.source)).arrayBuffer());
      const audible = buffer.getChannelData(0).some(sample => Math.abs(sample) > .02);
      return {duration: buffer.duration, savedDuration: voice.duration, audible};
    });
    assert(take.audible, 'saved audio should contain the input tone');
    assert(Math.abs(take.duration - take.savedDuration) < .15);
    if (automatic) assert(take.duration > 5 && take.duration <= 20.1);
    else assert(take.duration > .5 && take.duration < 6);
    await page.reload({waitUntil: 'domcontentloaded'});
    await listen.click();
    await panel.getByRole('button', {name:'이 장면 대사 멈추기'}).waitFor();
    await page.waitForFunction(() => Number(document.querySelector('canvas[data-time]')?.dataset.time) > .1);
    await panel.getByRole('button', {name:'이 장면 대사 멈추기'}).click();
  }
  await page.evaluate(() => {
    Object.getPrototypeOf(navigator.mediaDevices).getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
  });
  await record.click();
  await panel.getByRole('alert').filter({hasText:'마이크를 허용'}).waitFor();
  await listen.waitFor();
}
