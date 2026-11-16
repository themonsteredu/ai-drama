'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {
  ClassError, classApi, classProjectUrl, classStorageKey, readClassProject,
  type Classroom as Room, type ClassGroup,
} from '@/lib/play-class-client';
import {isClassSceneNumber, type ClassSceneNumber} from '@/lib/play-class-scenes';
import {loadDrawing, saveDrawing} from '@/lib/drawing-storage';
import {emptyDrawingProject, type DrawingProject} from '@/lib/drawing-project';
import type {GroupWork} from '@/lib/group-project';
import {clockLabel} from '@/lib/drawing-movie';
import {fileName} from '@/lib/project-files';
import {DrawingStudio} from './drawing-studio';
import {DrawingMovieDialog} from './drawing-movie-dialog';
import {ClassroomWorkBar, localClassState, saveClassState} from './classroom-work';
import {GroupProjectDialog} from './group-project-dialog';
import {GroupMovieDialog} from './group-movie-dialog';
import {SceneNumberPicker} from './scene-submit-dialog';
import {StudentSceneWork} from './student-scene-work';
import {TeacherDownloads} from './teacher-downloads';
import {TeacherScenePanel} from './teacher-scene-panel';
import './classroom.css';

type ClassroomGroup = {room: Room; group: number};
type Work = ClassroomGroup & {revision: number; dirty: boolean; conflict: boolean; key: number};
type MergeRequest = {works: GroupWork[]; video: boolean};

function workspaceChoice(classId: string, group: number, value?: 'pick' | 'shared' | ClassSceneNumber) {
  try {
    const key = classStorageKey(classId, group) + ':workspace';
    if (value !== undefined) sessionStorage.setItem(key, String(value));
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function Classroom({teacherMode = false, downloadMode = false}: {teacherMode?: boolean; downloadMode?: boolean}) {
  const [ready, setReady] = useState(false);
  const [teacher, setTeacher] = useState(false);
  const [pin, setPin] = useState('');
  const [code, setCode] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [work, setWork] = useState<Work | null>(null);
  const [studentGroup, setStudentGroup] = useState<ClassroomGroup | null>(null);
  const [studentScene, setStudentScene] = useState<ClassSceneNumber | null>(null);
  const [title, setTitle] = useState('우리 반 이야기');
  const [groupCount, setGroupCount] = useState(6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [teacherEdit, setTeacherEdit] = useState<'teacher-assembly' | 'teacher-preview' | null>(null);
  const [merge, setMerge] = useState<MergeRequest | null>(null);
  const [movie, setMovie] = useState<{project: DrawingProject; name: string} | null>(null);
  const [videos, setVideos] = useState(false);
  const lock = useRef(false);

  const expireSession = useCallback(() => {
    setTeacher(false);
    setMerge(null);
    setMovie(null);
    setVideos(false);
    setTeacherEdit(null);
  }, []);

  async function run(operation: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await operation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '다시 눌러 주세요.');
      if (teacherMode && cause instanceof ClassError && cause.status === 401) expireSession();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function listRooms() {
    const result = await classApi<{rooms: Room[]}>({action: 'list'});
    setRooms(result.rooms);
  }

  async function roster(id: string, open?: boolean) {
    const result = await classApi<{room: Room; groups: ClassGroup[]}>({
      action: open === undefined ? 'roster' : 'toggle', classId: id, open,
    });
    setRoom(result.room);
    setGroups(result.groups);
  }

  async function enterShared(classId: string, group: number, force = false) {
    const result = await classApi<{room: Room; revision: number; url: string | null}>({action: 'work', classId, group});
    const key = classStorageKey(classId, group);
    const local = await loadDrawing(key);
    const state = localClassState(key);
    const dirty = !!(local && state?.dirty && !force);
    const project = dirty ? local! : result.url ? await readClassProject(result.url) : {...emptyDrawingProject(), title: group + '모둠 이야기'};
    const revision = dirty ? state!.revision : result.revision;
    await saveDrawing(project, key);
    saveClassState(key, {revision, dirty});
    workspaceChoice(classId, group, 'shared');
    setRoom(result.room);
    setWork({room: result.room, group, revision, dirty, conflict: dirty && revision !== result.revision, key: Date.now()});
  }

  async function resumeStudent(classId: string, group: number) {
    const choice = workspaceChoice(classId, group);
    if (choice === 'shared' || (!choice && localClassState(classStorageKey(classId, group)))) {
      await enterShared(classId, group);
      return;
    }
    const result = await classApi<{room: Room}>({action: 'student-room', classId, group});
    setRoom(result.room);
    setStudentGroup({room: result.room, group});
    const scene = Number(choice);
    if (isClassSceneNumber(scene)) setStudentScene(scene);
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await classApi<{teacher: boolean; student: {classId: string; group: number} | null}>({action: 'session'});
        if (!active) return;
        setTeacher(session.teacher);
        if (teacherMode && session.teacher && !downloadMode) await listRooms();
        if (!teacherMode && session.student) await resumeStudent(session.student.classId, session.student.group);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : '연결을 확인해 주세요.');
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {active = false;};
  }, [teacherMode, downloadMode]);

  useEffect(() => {
    if (!teacherMode || !teacher || !room || teacherEdit) return;
    let running = false;
    let left = false;
    const id = room.id;
    const timer = setInterval(() => {
      if (document.hidden || running || lock.current) return;
      running = true;
      void classApi<{room: Room; groups: ClassGroup[]}>({action: 'roster', classId: id}).then(result => {
        if (!left) {setRoom(result.room); setGroups(result.groups);}
      }).catch(cause => {
        if (left) return;
        if (cause instanceof ClassError && cause.status === 401) expireSession();
        else setError(cause instanceof Error ? cause.message : '현황 연결을 확인해 주세요.');
      }).finally(() => {running = false;});
    }, 5000);
    return () => {left = true; clearInterval(timer);};
  }, [teacherMode, teacher, room?.id, teacherEdit, expireSession]);

  async function login() {
    await classApi({action: 'teacher-login', pin});
    setPin('');
    setTeacher(true);
    if (!downloadMode) await listRooms();
  }

  async function lockTeacher() {
    await classApi({action: 'teacher-logout'});
    setRoom(null);
    expireSession();
  }

  async function join(group: number) {
    if (!room) return;
    const result = await classApi<{room: Room}>({action: 'join', code: room.code, group});
    workspaceChoice(result.room.id, group, 'pick');
    setStudentGroup({room: result.room, group});
    setStudentScene(null);
  }

  async function leaveGroup() {
    await classApi({action: 'leave'});
    setWork(null);
    setStudentGroup(null);
    setStudentScene(null);
  }

  async function collectGroups(video: boolean) {
    if (!room) return;
    const works: GroupWork[] = [];
    for (const group of [...picked].sort((a, b) => a - b)) {
      works.push({id: room.id + '-' + group, name: group + '모둠', project: await readClassProject(await classProjectUrl(room.id, group))});
    }
    setMerge({works, video});
  }

  async function openGroup(group: number, asVideo: boolean) {
    if (!room) return;
    const project = await readClassProject(await classProjectUrl(room.id, group));
    if (asVideo) {
      setMovie({project, name: fileName(room.title + ' - ' + group + '모둠')});
    } else {
      await saveDrawing(project, 'teacher-preview');
      setTeacherEdit('teacher-preview');
    }
  }

  if (!ready) return <main className="class-page"><p role="status">수업을 준비하고 있어요…</p></main>;
  if (!teacherMode && studentGroup && studentScene) return <StudentSceneWork work={{...studentGroup, scene: studentScene}} onBack={() => {
    workspaceChoice(studentGroup.room.id, studentGroup.group, 'pick');
    setStudentScene(null);
  }}/>;
  if (work && !teacherMode) return <>
    <DrawingStudio key={work.key} storageKey={classStorageKey(work.room.id, work.group)}
      classroomBar={editor => <ClassroomWorkBar e={editor} {...work} initialDirty={work.dirty} initialConflict={work.conflict}
        onLeave={() => void run(leaveGroup)} onReload={() => run(() => enterShared(work.room.id, work.group, true))}/>}/>
    {error && <div className="class-floating-error" role="alert">{error}</div>}
  </>;
  if (teacherEdit && teacherMode && teacher) return <DrawingStudio key={teacherEdit} storageKey={teacherEdit} teacherMode
    classroomBar={() => <section className="class-work-bar">
      <strong>{teacherEdit === 'teacher-preview' ? '모둠 작품 편집' : '합친 작품의 장면과 전환효과를 편집할 수 있어요.'}</strong>
      <button onClick={() => setTeacherEdit(null)}>모둠 현황으로</button>
    </section>}/>;

  return <main className="class-page">
    <header>
      <a href="/class" className="class-brand">MOAKIT <b>PLAY</b></a>
      <nav><a href="/draw">내 기기의 작품</a>{teacherMode ? <a href="/class">학생 화면</a> : <a href="/class/teacher">교사 화면</a>}</nav>
    </header>
    {!teacherMode ? <section className="class-entry">
      <span className="class-eyebrow">우리 모둠 이야기 만들기</span>
      <h1>{studentGroup ? '내가 만들 장면을 골라요' : room ? '우리 모둠을 골라요' : '수업코드를 눌러요'}</h1>
      {studentGroup ? <>
        <p>{studentGroup.room.title} · {studentGroup.group}모둠</p>
        <div className="class-scene-picker"><SceneNumberPicker label="장면 번호" disabled={busy} onPick={scene => {
            workspaceChoice(studentGroup.room.id, studentGroup.group, scene);
            setStudentScene(scene);
        }}/></div>
        <div className="class-scene-picker-actions">
          <button disabled={busy} onClick={() => void run(() => enterShared(studentGroup.room.id, studentGroup.group))}>모둠 공동 작품 열기</button>
          <button disabled={busy} onClick={() => void run(leaveGroup)}>모둠 다시 선택</button>
        </div>
      </> : room ? <>
        <p>{room.title} · {room.code}</p>
        <div className="class-group-grid">{Array.from({length: room.group_count}, (_, index) => index + 1).map(n =>
          <button key={n} disabled={busy} onClick={() => void run(() => join(n))}><b>{n}</b>모둠</button>)}</div>
        <button disabled={busy} onClick={() => setRoom(null)}>수업코드 다시 입력</button>
      </> : <form onSubmit={event => {
        event.preventDefault();
        void run(async () => {
          const result = await classApi<{room: Room}>({action: 'lookup', code});
          setRoom(result.room);
        });
      }}>
        <label htmlFor="class-code">선생님이 알려 준 숫자 6자리</label>
        <input id="class-code" aria-label="수업코드" inputMode="numeric" pattern="[0-9]{6}" autoComplete="off" maxLength={6}
          placeholder="000000" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))}/>
        <button className="class-primary" disabled={busy || code.length !== 6}>{busy ? '확인 중…' : '들어가기'}</button>
      </form>}
      <p className="class-help">장면을 완성하면 ‘선생님께 보내기’를 눌러요.</p>
    </section> : !teacher ? <section className="class-entry">
      <span className="class-eyebrow">교사 화면</span>
      <h1>{downloadMode ? '작품 다운로드' : '우리 반 작품 모으기'}</h1>
      <form onSubmit={event => {event.preventDefault(); void run(login);}}>
        <label htmlFor="teacher-pin">교사 확인 번호</label>
        <input id="teacher-pin" type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={event => setPin(event.target.value)}/>
        <button className="class-primary" disabled={busy || !pin}>{busy ? '확인 중…' : '교사로 들어가기'}</button>
      </form>
    </section> : downloadMode ? <TeacherDownloads onSessionExpired={expireSession} onLock={() => void run(lockTeacher)} locking={busy}/> :
    <section className="class-teacher">
      <div className="class-heading">
        <div><span className="class-eyebrow">교사 화면</span><h1>우리 반 작품 모으기</h1></div>
        <div className="class-download-actions">
          <a className="class-download-link" href="/class/teacher/downloads">작품 다운로드</a>
          <button disabled={busy} onClick={() => void run(lockTeacher)}>교사 화면 잠그기</button>
        </div>
      </div>
      <div className="class-teacher-layout">
        <aside>
          <form onSubmit={event => {
            event.preventDefault();
            void run(async () => {
              const result = await classApi<{room: Room}>({action: 'create', title, groups: groupCount});
              setPicked([]);
              await listRooms();
              await roster(result.room.id);
            });
          }}>
            <h2>수업 만들기</h2>
            <label>수업 이름<input value={title} maxLength={80} onChange={event => setTitle(event.target.value)}/></label>
            <label>모둠 수<select value={groupCount} onChange={event => setGroupCount(Number(event.target.value))}>
              {Array.from({length: 12}, (_, index) => index + 1).map(n => <option key={n} value={n}>{n}모둠</option>)}
            </select></label>
            <button className="class-primary" disabled={busy || !title.trim()}>숫자 수업코드 만들기</button>
          </form>
          <h2>내 수업</h2>
          <div className="class-room-list">{rooms.map(item =>
            <button key={item.id} aria-pressed={room?.id === item.id} disabled={busy} onClick={() => void run(async () => {
              setPicked([]);
              await roster(item.id);
            })}><strong>{item.title}</strong><span>{item.code} · {item.is_open ? '진행 중' : '마침'}</span></button>)}</div>
          <a href="/settings">GPT API 설정</a>
          <button disabled={busy} onClick={() => setMerge({works: [], video: true})}>작품 파일로 영상 합치기</button>
          <button disabled={busy} onClick={() => setVideos(true)}>완성된 영상 파일 합치기</button>
        </aside>
        <div className="class-roster">{room ? <>
          <div className="class-code-banner">
            <div><h2>{room.title}</h2><span>학생에게 알려 줄 수업코드</span><strong>{room.code}</strong></div>
            <button disabled={busy} onClick={() => void run(async () => {
              await roster(room.id, !room.is_open);
              await listRooms();
            })}>{room.is_open ? '수업 마치기' : '수업 다시 열기'}</button>
          </div>
          <TeacherScenePanel key={room.id} room={room} onSessionExpired={expireSession}/>
          <h2>모둠 공동 작품</h2>
          <div className="class-roster-toolbar"><span>{room.is_open ? '5초마다 확인' : '마친 수업'}</span>
            <button disabled={busy} onClick={() => void run(() => roster(room.id))}>공동 작품 새로 확인</button>
            <button disabled={busy} onClick={() => setPicked(groups.filter(group => group.revision > 0).map(group => group.group_no))}>저장된 모둠 모두 선택</button>
          </div>
          <div className="class-roster-list">{groups.map(group => <article key={group.group_no}>
            <label><input type="checkbox" disabled={busy || group.revision === 0} checked={picked.includes(group.group_no)}
              onChange={event => setPicked(event.target.checked ? [...picked, group.group_no] : picked.filter(number => number !== group.group_no))}/>
              <b>{group.group_no}모둠</b></label>
            <div><strong>{group.revision ? group.submitted ? '보내기 완료' : '작업 저장됨' : '아직 저장 전'}</strong>
              <span>{group.summary.scenes ? group.summary.scenes + '장면 · ' + clockLabel(group.summary.seconds || 0) : '공동 작품을 기다리고 있어요.'}</span>
              <small>{group.summary.title}</small></div>
            <div className="class-download-actions">
              <button disabled={busy || !group.revision} aria-label={group.group_no + '모둠 공동 작품 영상 다운로드'}
                onClick={() => void run(() => openGroup(group.group_no, true))}>영상 다운로드</button>
              <button disabled={busy || !group.revision} onClick={() => void run(() => openGroup(group.group_no, false))}>편집으로 열기</button>
            </div>
          </article>)}</div>
          <div className="class-download-actions class-group-exports">
            <button className="class-primary" disabled={busy || !picked.length} onClick={() => void run(() => collectGroups(true))}>
              {picked.length ? '선택한 ' + picked.length + '개 모둠 영상 합치기' : '모둠 영상 합치기'}
            </button>
            <button disabled={busy || !picked.length} onClick={() => void run(() => collectGroups(false))}>편집용으로 모으기</button>
          </div>
        </> : <p className="class-empty">수업을 만들거나 목록에서 골라 주세요.</p>}</div>
      </div>
    </section>}
    {error && <p className="class-error" role="alert">{error}</p>}
    {merge && teacher && <GroupProjectDialog project={emptyDrawingProject()} initialWorks={merge.works} videoOnly={merge.video}
      onClose={() => setMerge(null)} onVideos={() => {setMerge(null); setVideos(true);}} onApply={project => {
        if (merge.video) setMovie({project, name: fileName(project.title)});
        else void run(async () => {await saveDrawing(project, 'teacher-assembly'); setTeacherEdit('teacher-assembly');});
      }}/>}
    {videos && teacher && <GroupMovieDialog onClose={() => setVideos(false)}/>}
    {movie && teacher && <DrawingMovieDialog project={movie.project} downloadName={movie.name} onClose={() => setMovie(null)}/>}
  </main>;
}
