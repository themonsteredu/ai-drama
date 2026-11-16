'use client';

import {useEffect, useRef, useState} from 'react';
import {
  ClassError, classApi, classProjectUrl, fetchClassProject, listSceneProjects, readClassProject, sceneProjectUrl,
  type SavedClassPage, type SavedClassProject,
} from '@/lib/play-class-client';
import type {SavedSceneProject} from '@/lib/play-class-scenes';
import {listSavedDrawings, loadDrawing, type SavedDeviceProject} from '@/lib/drawing-storage';
import type {DrawingProject} from '@/lib/drawing-project';
import {downloadBlob, fileName} from '@/lib/project-files';
import {DrawingMovieDialog} from './drawing-movie-dialog';
import './teacher-downloads.css';

type ServerProject = ({source: 'server'} & SavedClassProject) | ({source: 'scene'} & SavedSceneProject);
type SavedProject = ServerProject | ({source: 'device'} & SavedDeviceProject);

async function listGroupProjects(): Promise<ServerProject[]> {
  const projects: ServerProject[] = [];
  let next: SavedClassPage['next'] = null;
  do {
    const page: SavedClassPage = await classApi({action: 'saved-projects', ...next});
    projects.push(...page.projects.map(project => ({...project, source: 'server'} as const)));
    next = page.next;
  } while (next);
  return projects;
}

async function listServerProjects(): Promise<ServerProject[]> {
  const [groups, scenes] = await Promise.all([listGroupProjects(), listSceneProjects()]);
  return [...groups, ...scenes.map(project => ({...project, source: 'scene'} as const))].sort(byDate);
}

function byDate(a: SavedProject, b: SavedProject) {
  return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
}

function sourceLabel(project: SavedProject) {
  if (project.source === 'scene') return `${project.classTitle} · ${project.group}모둠 · 장면${project.scene}`;
  if (project.source === 'server') return `${project.classTitle} · ${project.group}모둠`;
  if (project.key === 'active') return '그림 편집기';
  if (project.key === 'four-scene-film') return '4장면 작업';
  if (project.key === 'teacher-assembly') return '교사 편집 작품';
  if (project.key === 'teacher-preview') return '교사 모둠 편집본';
  const scene = /^class:[^:]+:(\d+):scene:(\d+)$/.exec(project.key);
  if (scene) return `${scene[1]}모둠 장면${scene[2]} 작업`;
  const group = /^class:[^:]+:(\d+)$/.exec(project.key)?.[1];
  return group ? `${group}모둠 작업` : '기기 자동 저장';
}

function projectName(project: SavedProject) {
  return `${fileName(sourceLabel(project))} - ${fileName(project.title)}`;
}

function formattedDate(value: string | null) {
  const date = new Date(value ?? '');
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString('ko-KR', {dateStyle: 'medium', timeStyle: 'short'});
}

function serverProjectUrl(project: ServerProject) {
  return project.source === 'scene' ? sceneProjectUrl(project.id) : classProjectUrl(project.classId, project.group);
}

async function deviceProject(project: SavedDeviceProject) {
  const value = await loadDrawing(project.key);
  if (!value) throw new Error('이 기기에 저장된 작품을 찾지 못했어요.');
  return value;
}

async function projectFile(project: SavedProject) {
  if (project.source !== 'device') return (await fetchClassProject(await serverProjectUrl(project))).blob();
  return new Blob([JSON.stringify(await deviceProject(project))], {type: 'application/json'});
}

function sessionExpired(error: unknown) {
  return error instanceof ClassError && error.status === 401;
}

export function TeacherDownloads({onSessionExpired, onLock, locking}: {
  onSessionExpired: () => void;
  onLock: () => void;
  locking: boolean;
}) {
  const [server, setServer] = useState<SavedProject[] | null>(null);
  const [device, setDevice] = useState<SavedProject[] | null>(null);
  const [serverError, setServerError] = useState('');
  const [deviceError, setDeviceError] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [movie, setMovie] = useState<{project: DrawingProject; name: string} | null>(null);
  const lock = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    let loading = true;
    void listServerProjects().then(projects => {
      if (loading) setServer(projects);
    }).catch(cause => {
      if (!loading) return;
      if (sessionExpired(cause)) onSessionExpired();
      else setServerError('수업 작품 목록을 불러오지 못했어요. 새로 확인해 주세요.');
    });
    void listSavedDrawings().then(projects => {
      if (loading) setDevice(projects.map(project => ({...project, source: 'device'} as const)).sort(byDate));
    }).catch(() => {
      if (loading) setDeviceError('이 기기의 작품 목록을 읽지 못했어요.');
    });
    return () => { loading = false; };
  }, [reload, onSessionExpired]);

  const projects = [...(device ?? []), ...(server ?? [])];
  const disabled = busy || locking;

  async function run(action: () => Promise<void>) {
    if (lock.current || locking) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await action();
    } catch (cause) {
      if (!alive.current) return;
      setStatus('');
      if (sessionExpired(cause)) onSessionExpired();
      else setError(cause instanceof Error ? cause.message : '다운로드를 준비하지 못했어요. 다시 눌러 주세요.');
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function saveArchive(entries: SavedProject[]) {
    setStatus('ZIP을 준비하고 있어요…');
    const {BlobReader, BlobWriter, ZipWriter} = await import('@zip.js/zip.js');
    const writer = new ZipWriter(new BlobWriter('application/zip'), {useWebWorkers: false});
    let count = 0;
    const skipped: string[] = [];
    try {
      for (const [index, project] of entries.entries()) {
        if (!alive.current) break;
        setStatus(`작품 파일 ${index + 1} / ${entries.length} 준비 중…`);
        let blob: Blob;
        try {
          blob = await projectFile(project);
        } catch (cause) {
          if (sessionExpired(cause)) throw cause;
          skipped.push(projectName(project));
          continue;
        }
        const folder = project.source === 'device' ? '이 기기의 작품' : '수업 작품';
        await writer.add(`${folder}/${index + 1}. ${projectName(project)}.json`, new BlobReader(blob), {level: 0});
        count++;
      }
    } catch (cause) {
      await writer.close().catch(() => {});
      throw cause;
    }
    const archive = await writer.close();
    if (!alive.current) return;
    if (!count) throw new Error('다운로드할 작품을 불러오지 못했어요. 목록을 다시 확인해 주세요.');
    const date = new Date().toLocaleDateString('sv-SE');
    downloadBlob(archive, `MOAKIT-PLAY-${date}${skipped.length ? '-일부' : ''}.zip`);
    setStatus(`작품 ${count}개를 ZIP으로 저장했어요.`);
    if (skipped.length) setError(`받지 못한 작품 ${skipped.length}개 · ${skipped.join(', ')}`);
  }

  function projectList(entries: SavedProject[] | null, problem: string, empty: string) {
    if (problem) return <p className="class-download-error" role="alert">{problem}</p>;
    if (!entries) return <p role="status">작품 목록을 불러오는 중이에요…</p>;
    if (!entries.length) return <p>{empty}</p>;
    return <ul className="class-download-list">
      {entries.map(project => {
        const detail = [sourceLabel(project), project.scenes && `${project.scenes}장면`, formattedDate(project.updatedAt)].filter(Boolean).join(' · ');
        const key = project.source === 'device' ? project.key : project.source === 'scene' ? project.id : `${project.classId}:${project.group}`;
        return <li key={key}>
          <div><strong>{project.title}</strong><small>{detail}</small></div>
          <div className="class-download-actions">
            <button disabled={disabled} aria-label={`${project.title} 작품 파일 받기`} onClick={() => void run(async () => {
              const blob = await projectFile(project);
              if (!alive.current) return;
              downloadBlob(blob, `${projectName(project)}.json`);
              setStatus('그림과 녹음이 포함된 작품 파일을 저장했어요.');
            })}>작품 파일 받기</button>
            <button className="class-primary" disabled={disabled} aria-label={`${project.title} 영상 미리보기·다운로드`} onClick={() => void run(async () => {
              const value = project.source === 'device' ? await deviceProject(project) : await readClassProject(await serverProjectUrl(project));
              if (alive.current) setMovie({project: value, name: projectName(project)});
            })}>영상 미리보기·다운로드</button>
          </div>
        </li>;
      })}
    </ul>;
  }

  return <section className="class-teacher class-downloads">
    <div className="class-heading">
      <div><span className="class-eyebrow">교사 화면</span><h1>작품 다운로드</h1></div>
      <div className="class-download-actions"><a className="class-download-link" href="/class/teacher">수업 관리 · 영상 합치기</a><button disabled={disabled} onClick={onLock}>화면 잠그기</button></div>
    </div>
    <div className="class-download-toolbar">
      <p>영상은 작품별로 만들 수 있어요. 작품 파일에는 그림, 녹음, 편집 내용이 들어 있어요.</p>
      <div className="class-download-actions">
        <button disabled={disabled} onClick={() => {
          setServer(null); setDevice(null); setServerError(''); setDeviceError(''); setStatus(''); setError(''); setReload(n => n + 1);
        }}>새로 확인</button>
        <button className="class-primary" disabled={disabled || !server || !device || !projects.length} onClick={() => void run(() => saveArchive(projects))}>전체 작품 ZIP 받기{projects.length ? ` (${projects.length}개)` : ''}</button>
      </div>
    </div>
    {status && <p className="class-download-status" role="status">{status}</p>}
    {error && <p className="class-download-error" role="alert">{error}</p>}
    <section className="class-download-section" aria-labelledby="device-works">
      <h2 id="device-works">이 기기에 저장된 작품</h2>
      <p>작업할 때 사용한 기기와 브라우저에서 이 화면을 열어 주세요.</p>
      {projectList(device, deviceError, '이 브라우저에 저장된 작품이 없어요.')}
    </section>
    <section className="class-download-section" aria-labelledby="class-works">
      <h2 id="class-works">수업에 저장·제출된 작품</h2>
      {projectList(server, serverError, '수업코드로 입장해 저장한 작품이 아직 없어요.')}
    </section>
    {movie && <DrawingMovieDialog project={movie.project} downloadName={movie.name} onClose={() => setMovie(null)}/>}
  </section>;
}
