'use client';

import {useEffect, useRef, useState} from 'react';
import {classApi, submitSceneProject, type Classroom} from '@/lib/play-class-client';
import {CLASS_SCENE_NUMBERS, type ClassSceneNumber} from '@/lib/play-class-scenes';
import type {DrawingProject} from '@/lib/drawing-project';
import {submitSceneSnapshot} from '@/lib/play-scene-projection';
import './class-scenes.css';

type SelectedScene = {room: Classroom; group: number; scene: ClassSceneNumber};

export function SceneNumberPicker({label, value, disabled, onPick}: {
  label: string; value?: ClassSceneNumber | null; disabled: boolean; onPick: (scene: ClassSceneNumber) => void;
}) {
  return <fieldset className="scene-choice">
    <legend>{label}</legend>
    <div>{CLASS_SCENE_NUMBERS.slice(0, 4).map(number => <button key={number} type="button" aria-pressed={value === number}
      disabled={disabled} onClick={() => onPick(number)}>장면{number}</button>)}</div>
    <button type="button" className="scene-choice-extra" aria-pressed={value === 5} aria-label="장면5" disabled={disabled}
      onClick={() => onPick(5)}>장면5 <small>5명 모둠</small></button>
  </fieldset>;
}

export function SceneSubmitDialog({project, selected, onSubmitted, onClose}: {
  project: DrawingProject;
  selected?: SelectedScene;
  onSubmitted?: (scene: ClassSceneNumber) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState('');
  const [room, setRoom] = useState<Classroom | null>(selected?.room ?? null);
  const [group, setGroup] = useState(selected?.group ?? 0);
  const [scene, setScene] = useState<ClassSceneNumber | null>(selected?.scene ?? null);
  const [sourceScene, setSourceScene] = useState(project.activeSceneId);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => before?.focus();
  }, []);

  async function run(operation: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await operation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '작품을 보내지 못했어요. 다시 눌러 주세요.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function lookup() {
    const {room: target} = await classApi<{room: Classroom}>({action: 'lookup', code});
    setRoom(target);
    setGroup(target.group_count === 1 ? 1 : 0);
    setScene(null);
  }

  async function submit() {
    if (!room || !group || !scene) return;
    const snapshot = await submitSceneSnapshot(project, sourceScene);
    const result = await submitSceneProject(snapshot, selected ? {classId: room.id, group} : {code: room.code, group}, scene);
    if (result.isLatest === false) {
      setError('같은 번호로 더 최근에 보낸 작품이 있어요. 선생님 화면에는 최신 작품이 보여요.');
      return;
    }
    setSubmitted(true);
    onSubmitted?.(scene);
  }

  return <dialog ref={dialog} className="scene-submit" aria-labelledby="scene-submit-title" onCancel={event => {
    event.preventDefault();
    if (!lock.current) onClose();
  }}>
    <div className="scene-submit-heading"><h2 id="scene-submit-title">장면 제출하기</h2><button type="button" disabled={busy} onClick={onClose}>닫기</button></div>
    <p className="scene-submit-project">{project.title || '내 작품'}</p>
    {submitted ? <p className="scene-submit-success" role="status">{room?.title} · {group}모둠 · 장면{scene} 제출 완료</p> : !room ?
      <form onSubmit={event => {event.preventDefault(); void run(lookup);}}>
        <label htmlFor="scene-submit-code">선생님이 알려 준 수업코드 6자리</label>
        <input id="scene-submit-code" inputMode="numeric" autoComplete="off" value={code} maxLength={6} disabled={busy}
          onChange={event => setCode(event.target.value.replace(/\D/g, ''))}/>
        <button className="scene-primary" disabled={busy || code.length !== 6}>{busy ? '확인 중…' : '수업 확인'}</button>
      </form> :
      <form onSubmit={event => {event.preventDefault(); void run(submit);}}>
        <p className="scene-submit-destination" aria-live="polite">{room.title}{group > 0 ? ` · ${group}모둠` : ''}{scene ? ` · 장면${scene}` : ''}</p>
        {!selected && <>
          <label htmlFor="scene-submit-group">우리 모둠</label>
          <select id="scene-submit-group" disabled={busy} value={group} onChange={event => setGroup(Number(event.target.value))}>
            <option value={0}>모둠을 골라 주세요</option>
            {Array.from({length: room.group_count}, (_, index) => index + 1).map(number => <option key={number} value={number}>{number}모둠</option>)}
          </select>
        </>}
        <SceneNumberPicker label="제출할 장면 번호" value={scene} disabled={busy} onPick={setScene}/>
        {project.scenes.length > 1 && <>
          <label htmlFor="scene-submit-source">보낼 그림 장면</label>
          <select id="scene-submit-source" value={sourceScene} disabled={busy} onChange={event => setSourceScene(event.target.value)}>
            {project.scenes.map((item, index) => <option key={item.id} value={item.id}>{index + 1}번째 · {item.title}</option>)}
          </select>
        </>}
        <button className="scene-primary" disabled={busy || !group || !scene}>{busy ? '작품을 보내고 있어요…' : '선생님께 보내기'}</button>
        {!selected && <button type="button" disabled={busy} onClick={() => {setRoom(null); setError('');}}>수업코드 다시 입력</button>}
      </form>}
    {error && <p className="scene-error" role="alert">{error}</p>}
  </dialog>;
}
