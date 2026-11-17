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
  const [submission, setSubmission] = useState<{version: string; scene: ClassSceneNumber} | null>(null);
  const disabled = !editor.loaded || editor.busy || editor.recording || leaving;
  const sentScene = submission?.version === editor.project.updatedAt ? submission.scene : null;

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
    <div><strong>{work.room.title} · {work.group}모둠 · 장면{work.scene}</strong><small role="status">{sentScene ? `장면${sentScene}로 선생님께 보냈어요.` : '완성한 장면을 선생님께 보내요.'}</small></div>
    <div className="class-work-actions">
      <button className="class-primary" disabled={disabled} onClick={() => {editor.stop(); setSubmit(true);}}>{sentScene ? '다시 보내기' : '선생님께 보내기'}</button>
      <button disabled={disabled} onClick={() => void back()}>장면 선택</button>
    </div>
    {submit && <SceneSubmitDialog project={editor.project} selected={{...work, scene: sentScene ?? work.scene}} onClose={() => setSubmit(false)}
      onSubmitted={scene => setSubmission({version: editor.project.updatedAt, scene})}/>}
  </section>;
}

export function StudentSceneWork({work, onBack}: {work: SceneWork; onBack: () => void}) {
  const storageKey = `${classStorageKey(work.room.id, work.group)}:scene:${work.scene}`;
  return <DrawingStudio key={storageKey} storageKey={storageKey}
    classroomBar={editor => <SceneWorkBar work={work} storageKey={storageKey} editor={editor} onBack={onBack}/>}/>;
}
