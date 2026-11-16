'use client';

import {useEffect, useRef, useState} from 'react';
import {ClassError, listSceneProjects, readClassProject, sceneProjectUrl, type Classroom} from '@/lib/play-class-client';
import {CLASS_SCENE_NUMBERS, type ClassSceneNumber, type SavedSceneProject} from '@/lib/play-class-scenes';
import {emptyDrawingProject, type DrawingProject} from '@/lib/drawing-project';
import type {GroupWork} from '@/lib/group-project';
import {fileName} from '@/lib/project-files';
import {DrawingMovieDialog} from './drawing-movie-dialog';
import {GroupProjectDialog} from './group-project-dialog';
import './class-scenes.css';

const submittedDate = new Intl.DateTimeFormat('ko-KR', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'});

export function TeacherScenePanel({room, onSessionExpired}: {room: Classroom; onSessionExpired: () => void}) {
  const [group, setGroup] = useState(1);
  const [works, setWorks] = useState<SavedSceneProject[] | null>(null);
  const [versions, setVersions] = useState<Partial<Record<ClassSceneNumber, string>>>({});
  const [excluded, setExcluded] = useState<ClassSceneNumber[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [recheck, setRecheck] = useState(0);
  const [merge, setMerge] = useState<GroupWork[] | null>(null);
  const [movie, setMovie] = useState<{project: DrawingProject; name: string} | null>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  const title = `${room.title} · ${group}모둠`;

  useEffect(() => {
    alive.current = true;
    return () => {alive.current = false;};
  }, []);

  useEffect(() => {
    let alive = true;
    let fetching = false;
    const refresh = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const projects = await listSceneProjects(room.id, group);
        if (alive) {
          setWorks(projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
          setListError('');
        }
      } catch (cause) {
        if (!alive) return;
        if (cause instanceof ClassError && cause.status === 401) onSessionExpired();
        else setListError('제출 장면을 불러오지 못했어요. 잠시 뒤 다시 확인해 주세요.');
      } finally {
        fetching = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden && !lock.current) void refresh();
    }, 5000);
    return () => {alive = false; clearInterval(timer);};
  }, [room.id, group, recheck, onSessionExpired]);

  const slots = CLASS_SCENE_NUMBERS.map(scene => {
    const options = works?.filter(work => work.scene === scene) ?? [];
    return {scene, options, current: options.find(work => work.id === versions[scene]) ?? options[0]};
  }).filter(slot => slot.scene !== 5 || slot.options.length > 0);
  const selected = slots.flatMap(({scene, current}) => !current || excluded.includes(scene) ? [] : [current]);

  async function run(operation: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await operation();
    } catch (cause) {
      if (!alive.current) return;
      if (cause instanceof ClassError && cause.status === 401) onSessionExpired();
      else setError(cause instanceof Error ? cause.message : '작품을 열지 못했어요. 다시 눌러 주세요.');
    } finally {
      lock.current = false;
      if (alive.current) {setBusy(false); setStatus('');}
    }
  }

  async function openMovie(work: SavedSceneProject) {
    const label = `장면${work.scene}`;
    setStatus(`${label} 영상 준비 중…`);
    const project = await readClassProject(await sceneProjectUrl(work.id));
    if (alive.current) setMovie({project, name: `${fileName(title)} - ${label}`});
  }

  async function openMerge() {
    const entries: GroupWork[] = [];
    for (const work of selected) {
      if (!alive.current) return;
      const name = `장면${work.scene}`;
      setStatus(`${name} 불러오는 중…`);
      entries.push({id: work.id, name, project: await readClassProject(await sceneProjectUrl(work.id))});
    }
    if (alive.current) setMerge(entries);
  }

  return <section className="class-scene-panel" aria-labelledby="class-scene-heading">
    <h2 id="class-scene-heading">모둠별 제출 장면</h2>
    <p>학생이 고른 장면 번호순으로 모여요. 같은 번호의 제출이 여러 개면 쓸 작품을 고를 수 있어요.</p>
    <div className="class-download-actions">
      <label htmlFor="scene-review-group">볼 모둠</label>
      <select id="scene-review-group" disabled={busy} value={group} onChange={event => {
        setGroup(Number(event.target.value)); setWorks(null); setVersions({}); setExcluded([]); setError(''); setListError('');
      }}>
        {Array.from({length: room.group_count}, (_, index) => index + 1).map(n => <option key={n} value={n}>{n}모둠</option>)}
      </select>
      <button disabled={busy} onClick={() => setRecheck(value => value + 1)}>제출 장면 새로 확인</button>
    </div>
    {!works && !listError && <p role="status">장면 목록을 불러오는 중이에요…</p>}
    {listError && <p className="scene-error" role="alert">{listError}</p>}
    {works && <ul>{slots.map(({scene, options, current}) => <li key={scene}>
      <label><input type="checkbox" disabled={busy || !current} checked={!!current && !excluded.includes(scene)}
        onChange={event => setExcluded(event.target.checked ? excluded.filter(number => number !== scene) : [...excluded, scene])}/>
        <strong>장면{scene}</strong>
      </label>
      <div>{!current ? <small>아직 제출 전</small> : options.length > 1 ?
        <select aria-label={`장면${scene} 제출 작품 고르기`} value={current.id} disabled={busy}
          onChange={event => setVersions({...versions, [scene]: event.target.value})}>
          {options.map((work, index) => <option key={work.id} value={work.id}>
            {index === 0 ? '최근 제출 · ' : ''}{work.title} · {submittedDate.format(new Date(work.updatedAt))}
          </option>)}
        </select> : <><strong>{current.title}</strong><small>{submittedDate.format(new Date(current.updatedAt))} 제출</small></>}</div>
      {current && <button disabled={busy} aria-label={`장면${scene} 영상 다운로드`} onClick={() => void run(() => openMovie(current))}>영상 다운로드</button>}
    </li>)}</ul>}
    <button className="class-primary" disabled={busy || selected.length < 2} onClick={() => void run(openMerge)}>
      {selected.length ? `선택한 장면 ${selected.length}개 영상 합치기` : '장면 영상 합치기'}
    </button>
    {status && <p role="status">{status}</p>}
    {error && <p className="scene-error" role="alert">{error}</p>}
    {merge && <GroupProjectDialog project={emptyDrawingProject()} initialWorks={merge} initialTitle={title.slice(0, 80)} videoOnly
      onApply={project => setMovie({project, name: fileName(project.title)})} onClose={() => setMerge(null)}/>}
    {movie && <DrawingMovieDialog project={movie.project} downloadName={movie.name} onClose={() => setMovie(null)}/>}
  </section>;
}
