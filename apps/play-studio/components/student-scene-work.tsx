'use client';

import {useState} from 'react';
import {classStorageKey, type Classroom} from '@/lib/play-class-client';
import type {ClassSceneNumber} from '@/lib/play-class-scenes';
import {saveDrawing} from '@/lib/drawing-storage';
import {DrawingStudio} from './drawing-studio';
import {SceneSubmitDialog} from './scene-submit-dialog';
import type {useDrawingEditor} from './use-drawing-editor';

type SceneWork = {room: Classroom; group: number; scene: ClassSceneNumber};

function SceneWorkBar({work, storageKey, editor, onBack}: {
  work: SceneWork;
  storageKey: string;
  editor: ReturnType<typeof useDrawingEditor>;
  onBack: () => void;
}) {
  const [submit, setSubmit] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [submittedAt, setSubmittedAt] = useState('');
  const disabled = !editor.loaded || editor.busy || editor.recording || leaving;
  const submitted = submittedAt === editor.project.updatedAt;

  async function back() {
    setLeaving(true);
    try {
      if (editor.saveState !== '저장 확인 필요') await saveDrawing(editor.project, storageKey);
      onBack();
    } catch {
      editor.setError('이 기기에 저장하지 못했어요. 작품 보관을 눌러 먼저 파일로 받아 주세요.');
      setLeaving(false);
    }
  }

  return <section className="class-work-bar" aria-label="내 장면 제출">
    <div><strong>{work.room.title} · {work.group}모둠 · 장면{work.scene}</strong><small role="status">{submitted ? '선생님께 보냈어요.' : '완성한 장면을 선생님께 보내요.'}</small></div>
    <div className="class-work-actions">
      <button className="class-primary" disabled={disabled || submitted} onClick={() => {editor.stop(); setSubmit(true);}}>선생님께 보내기</button>
      <button disabled={disabled} onClick={() => void back()}>장면 선택</button>
    </div>
    {submit && <SceneSubmitDialog project={editor.project} selected={work} onClose={() => setSubmit(false)}
      onSubmitted={() => setSubmittedAt(editor.project.updatedAt)}/>}
  </section>;
}

export function StudentSceneWork({work, onBack}: {work: SceneWork; onBack: () => void}) {
  const storageKey = `${classStorageKey(work.room.id, work.group)}:scene:${work.scene}`;
  return <DrawingStudio key={storageKey} storageKey={storageKey}
    classroomBar={editor => <SceneWorkBar work={work} storageKey={storageKey} editor={editor} onBack={onBack}/>}/>;
}
