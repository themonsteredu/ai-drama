"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  STAGE_PROJECT_VERSION,
  clamp,
  clampStageCoordinate,
  createStageId,
  duplicateStageScene,
  isStageProject,
  nextStageZIndex,
  patchStageItem,
  removeStageItem,
  reorderStageItems,
  type CharacterAppearance,
  type SavedCharacter,
  type SpeechVariant,
  type StageItem,
  type StageProject,
  type StageScene,
} from "@moakit/stage-core";
import { CharacterPanel } from "@/components/character-panel";
import { Inspector } from "@/components/inspector";
import { StageBackdrop, StageItemView } from "@/components/stage-view";
import {
  backgrounds,
  bottomColors,
  hairColors,
  propChoices,
  skinTones,
  speechVariants,
  topColors,
} from "@/lib/catalog";

const STORAGE_KEY = "moakit-play-project-v1";
const MAX_SCENES = 6;

type PanelTab = "character" | "background" | "prop" | "speech";

type DragState = {
  itemId: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  startProject: StageProject;
  moved: boolean;
};

const defaultAppearance: CharacterAppearance = {
  skinTone: skinTones[1],
  hairStyle: "bob",
  hairColor: hairColors[0],
  eyeStyle: "round",
  topColor: topColors[0],
  bottomColor: bottomColors[0],
  accessory: "none",
};

const starterCharacter: SavedCharacter = {
  id: "cast-haneul",
  name: "하늘",
  appearance: defaultAppearance,
  expression: "happy",
  pose: "standing",
};

function createInitialProject(): StageProject {
  return {
    version: STAGE_PROJECT_VERSION,
    id: "play-project-starter",
    title: "우리 반의 비밀 상자",
    activeSceneId: "scene-1",
    cast: [starterCharacter],
    scenes: [
      {
        id: "scene-1",
        title: "장면 1",
        backgroundId: "classroom",
        items: [
          {
            id: "character-haneul-1",
            kind: "character",
            x: 43,
            y: 66,
            scale: 0.95,
            rotation: 0,
            zIndex: 2,
            data: { ...starterCharacter, facing: "right" },
          },
          {
            id: "speech-haneul-1",
            kind: "speech",
            x: 64,
            y: 28,
            scale: 1,
            rotation: 0,
            zIndex: 3,
            data: { text: "이 상자는 누구의 것일까?", variant: "speech" },
          },
          {
            id: "prop-box-1",
            kind: "prop",
            x: 68,
            y: 72,
            scale: 0.85,
            rotation: 0,
            zIndex: 1,
            data: { catalogId: "box", label: "상자", symbol: "□" },
          },
        ],
      },
    ],
    updatedAt: "2026-09-03T00:00:00.000Z",
  };
}

function touch(project: StageProject): StageProject {
  return { ...project, updatedAt: new Date().toISOString() };
}

function updateScene(project: StageProject, sceneId: string, updater: (scene: StageScene) => StageScene) {
  return {
    ...project,
    scenes: project.scenes.map((scene) => (scene.id === sceneId ? updater(scene) : scene)),
  };
}

function patchItemData(item: StageItem, patch: Record<string, unknown>): StageItem {
  return { ...item, data: { ...item.data, ...patch } } as StageItem;
}

export function PlayStudio() {
  const [project, setProject] = useState<StageProject>(createInitialProject);
  const projectRef = useRef(project);
  const [past, setPast] = useState<StageProject[]>([]);
  const [future, setFuture] = useState<StageProject[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [activeTab, setActiveTab] = useState<PanelTab>("character");
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [presentationOpen, setPresentationOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [draftCharacter, setDraftCharacter] = useState<SavedCharacter>({
    id: "draft-character",
    name: "나의 배우",
    appearance: { ...defaultAppearance },
    expression: "happy",
    pose: "standing",
  });

  const activeScene = useMemo(
    () => project.scenes.find((scene) => scene.id === project.activeSceneId) ?? project.scenes[0],
    [project.activeSceneId, project.scenes],
  );
  const selectedItem = activeScene?.items.find((item) => item.id === selectedId);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (isStageProject(parsed)) {
          projectRef.current = parsed;
          setProject(parsed);
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      setSaveState("saved");
    }, 320);
    return () => window.clearTimeout(timer);
  }, [hydrated, project]);

  function setProjectValue(next: StageProject) {
    projectRef.current = next;
    setProject(next);
  }

  function commit(updater: (current: StageProject) => StageProject) {
    const previous = projectRef.current;
    const next = touch(updater(previous));
    setPast((history) => [...history.slice(-29), previous]);
    setFuture([]);
    setProjectValue(next);
  }

  function updateWithoutHistory(updater: (current: StageProject) => StageProject) {
    setProjectValue(touch(updater(projectRef.current)));
  }

  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    setPast((history) => history.slice(0, -1));
    setFuture((history) => [projectRef.current, ...history].slice(0, 30));
    setProjectValue(previous);
    setSelectedId(undefined);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture((history) => history.slice(1));
    setPast((history) => [...history.slice(-29), projectRef.current]);
    setProjectValue(next);
    setSelectedId(undefined);
  }

  function updateActiveScene(updater: (scene: StageScene) => StageScene, record = true) {
    const action = (current: StageProject) => updateScene(current, current.activeSceneId, updater);
    if (record) commit(action);
    else updateWithoutHistory(action);
  }

  function addCharacterToScene(character: SavedCharacter) {
    updateActiveScene((scene) => ({
      ...scene,
      items: [
        ...scene.items,
        {
          id: createStageId("character"),
          kind: "character",
          x: 50,
          y: 68,
          scale: 0.9,
          rotation: 0,
          zIndex: nextStageZIndex(scene.items),
          data: { ...character, facing: "right" },
        },
      ],
    }));
  }

  function saveDraftCharacter(placeOnStage: boolean) {
    const savedCharacter: SavedCharacter = {
      ...draftCharacter,
      id: createStageId("cast"),
      name: draftCharacter.name.trim() || `배우 ${project.cast.length + 1}`,
      appearance: { ...draftCharacter.appearance },
    };

    commit((current) => {
      const withCast = { ...current, cast: [...current.cast, savedCharacter] };
      if (!placeOnStage) return withCast;
      return updateScene(withCast, withCast.activeSceneId, (scene) => ({
        ...scene,
        items: [
          ...scene.items,
          {
            id: createStageId("character"),
            kind: "character",
            x: 50,
            y: 68,
            scale: 0.9,
            rotation: 0,
            zIndex: nextStageZIndex(scene.items),
            data: { ...savedCharacter, facing: "right" },
          },
        ],
      }));
    });

    setDraftCharacter((current) => ({
      ...current,
      id: "draft-character",
      name: `나의 배우 ${project.cast.length + 2}`,
    }));
  }

  function addProp(catalogId: string, label: string, symbol: string) {
    updateActiveScene((scene) => ({
      ...scene,
      items: [
        ...scene.items,
        {
          id: createStageId("prop"),
          kind: "prop",
          x: 56,
          y: 68,
          scale: 0.9,
          rotation: 0,
          zIndex: nextStageZIndex(scene.items),
          data: { catalogId, label, symbol },
        },
      ],
    }));
  }

  function addSpeech(variant: SpeechVariant) {
    const defaultText = variant === "caption"
      ? "장면에서 일어난 일을 적어 보세요."
      : variant === "thought"
        ? "나는 어떻게 해야 하지?"
        : "대사를 입력하세요.";
    const itemId = createStageId("speech");
    updateActiveScene((scene) => ({
      ...scene,
      items: [
        ...scene.items,
        {
          id: itemId,
          kind: "speech",
          x: 60,
          y: variant === "caption" ? 12 : 28,
          scale: 1,
          rotation: 0,
          zIndex: nextStageZIndex(scene.items),
          data: { text: defaultText, variant },
        },
      ],
    }));
    setSelectedId(itemId);
  }

  function patchSelectedBase(patch: Partial<Pick<StageItem, "x" | "y" | "scale" | "rotation" | "zIndex">>) {
    if (!selectedItem) return;
    updateActiveScene((scene) => ({ ...scene, items: patchStageItem(scene.items, selectedItem.id, patch) }));
  }

  function patchSelectedData(patch: Record<string, unknown>, record = true) {
    if (!selectedItem) return;
    updateActiveScene((scene) => ({
      ...scene,
      items: scene.items.map((item) => (item.id === selectedItem.id ? patchItemData(item, patch) : item)),
    }), record);
  }

  function duplicateSelected() {
    if (!selectedItem) return;
    const newId = createStageId(selectedItem.kind);
    updateActiveScene((scene) => ({
      ...scene,
      items: [
        ...scene.items,
        {
          ...selectedItem,
          id: newId,
          x: clampStageCoordinate(selectedItem.x + 5),
          y: clampStageCoordinate(selectedItem.y + 5),
          zIndex: nextStageZIndex(scene.items),
          data: { ...selectedItem.data },
        } as StageItem,
      ],
    }));
    setSelectedId(newId);
  }

  function deleteSelected() {
    if (!selectedItem) return;
    updateActiveScene((scene) => ({ ...scene, items: removeStageItem(scene.items, selectedItem.id) }));
    setSelectedId(undefined);
  }

  function moveSelectedLayer(direction: -1 | 1) {
    if (!selectedItem) return;
    updateActiveScene((scene) => ({ ...scene, items: reorderStageItems(scene.items, selectedItem.id, direction) }));
  }

  function selectBackground(backgroundId: string) {
    updateActiveScene((scene) => ({ ...scene, backgroundId }));
  }

  function addScene() {
    if (project.scenes.length >= MAX_SCENES) return;
    const newSceneId = createStageId("scene");
    commit((current) => ({
      ...current,
      activeSceneId: newSceneId,
      scenes: [
        ...current.scenes,
        {
          id: newSceneId,
          title: `장면 ${current.scenes.length + 1}`,
          backgroundId: activeScene?.backgroundId ?? "blank",
          items: [],
        },
      ],
    }));
    setSelectedId(undefined);
  }

  function copyActiveScene() {
    if (!activeScene || project.scenes.length >= MAX_SCENES) return;
    const copy = duplicateStageScene(activeScene, `장면 ${project.scenes.length + 1}`);
    commit((current) => ({
      ...current,
      activeSceneId: copy.id,
      scenes: [...current.scenes, copy],
    }));
    setSelectedId(undefined);
  }

  function deleteActiveScene() {
    if (project.scenes.length === 1) return;
    const index = project.scenes.findIndex((scene) => scene.id === project.activeSceneId);
    const nextScene = project.scenes[index - 1] ?? project.scenes[index + 1];
    commit((current) => ({
      ...current,
      activeSceneId: nextScene.id,
      scenes: current.scenes.filter((scene) => scene.id !== current.activeSceneId),
    }));
    setSelectedId(undefined);
  }

  function switchScene(sceneId: string) {
    if (sceneId === project.activeSceneId) return;
    updateWithoutHistory((current) => ({ ...current, activeSceneId: sceneId }));
    setSelectedId(undefined);
  }

  function resetProject() {
    if (!window.confirm("현재 작품을 지우고 새 작품을 시작할까요?")) return;
    const next = createInitialProject();
    window.localStorage.removeItem(STORAGE_KEY);
    setPast([]);
    setFuture([]);
    setSelectedId(undefined);
    setProjectValue(next);
  }

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>, item: StageItem) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(item.id);
    dragRef.current = {
      itemId: item.id,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left - (item.x / 100) * rect.width,
      offsetY: event.clientY - rect.top - (item.y / 100) * rect.height,
      startProject: projectRef.current,
      moved: false,
    };
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!drag || !rect || drag.pointerId !== event.pointerId) return;
    const x = clampStageCoordinate(((event.clientX - rect.left - drag.offsetX) / rect.width) * 100);
    const y = clampStageCoordinate(((event.clientY - rect.top - drag.offsetY) / rect.height) * 100);
    drag.moved = true;
    updateActiveScene((scene) => ({
      ...scene,
      items: patchStageItem(scene.items, drag.itemId, { x, y }),
    }), false);
  }

  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) return;
    setPast((history) => [...history.slice(-29), drag.startProject]);
    setFuture([]);
  }

  function renderPanel() {
    if (activeTab === "character") {
      return (
        <CharacterPanel
          draft={draftCharacter}
          cast={project.cast}
          onDraftChange={setDraftCharacter}
          onSave={() => saveDraftCharacter(false)}
          onSaveAndPlace={() => saveDraftCharacter(true)}
          onPlace={(character) => addCharacterToScene(character)}
        />
      );
    }

    if (activeTab === "background") {
      return (
        <div className="asset-grid background-grid">
          {backgrounds.map((background) => (
            <button
              type="button"
              key={background.id}
              className={`asset-card ${activeScene?.backgroundId === background.id ? "active" : ""}`}
              onClick={() => selectBackground(background.id)}
            >
              <span className={`background-thumb background-${background.id}`}><span /></span>
              <strong>{background.label}</strong>
              <small>{background.description}</small>
            </button>
          ))}
        </div>
      );
    }

    if (activeTab === "prop") {
      return (
        <div className="asset-grid prop-grid">
          {propChoices.map((prop) => (
            <button type="button" className="asset-card prop-card" key={prop.id} onClick={() => addProp(prop.id, prop.label, prop.symbol)}>
              <span className="prop-symbol">{prop.symbol}</span>
              <strong>{prop.label}</strong>
              <small>눌러서 무대에 놓기</small>
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="speech-picker">
        <p className="panel-help">말풍선을 놓은 뒤 오른쪽에서 대사를 바로 고칠 수 있어요.</p>
        {speechVariants.map((variant) => (
          <button type="button" key={variant.id} className={`speech-sample ${variant.id}`} onClick={() => addSpeech(variant.id)}>
            <span>{variant.id === "caption" ? "장면 설명을 적어 보세요" : variant.id === "thought" ? "속으로 무슨 생각을 할까?" : "등장인물이 무엇이라고 말할까?"}</span>
            <strong>{variant.label} 추가</strong>
          </button>
        ))}
      </div>
    );
  }

  return (
    <main className="play-app">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">M</span>
          <div>
            <strong>MOAKIT PLAY</strong>
            <small>나만의 연극 만들기</small>
          </div>
        </div>
        <div className="header-center">
          <input
            className="project-title"
            aria-label="작품 제목"
            value={project.title}
            maxLength={40}
            onChange={(event) => updateWithoutHistory((current) => ({ ...current, title: event.target.value }))}
          />
          <span className={`save-state ${saveState}`}><i />{saveState === "saved" ? "자동 저장됨" : "저장 중"}</span>
        </div>
        <div className="header-actions">
          <button type="button" className="icon-button" onClick={undo} disabled={!past.length} title="실행 취소">↶</button>
          <button type="button" className="icon-button" onClick={redo} disabled={!future.length} title="다시 실행">↷</button>
          <button type="button" className="secondary-button" onClick={resetProject}>새 작품</button>
          <button type="button" className="primary-button" onClick={() => setPresentationOpen(true)}>▶ 발표하기</button>
        </div>
      </header>

      <section className="workspace-shell">
        <aside className="asset-panel">
          <div className="panel-heading">
            <p>무대 재료</p>
            <span>눌러서 추가</span>
          </div>
          <div className="panel-tabs" role="tablist" aria-label="무대 재료 종류">
            {([
              ["character", "내 캐릭터", "☺"],
              ["background", "배경", "▣"],
              ["prop", "소품", "◆"],
              ["speech", "대사", "▰"],
            ] as const).map(([id, label, icon]) => (
              <button type="button" role="tab" aria-selected={activeTab === id} key={id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>
                <span>{icon}</span>{label}
              </button>
            ))}
          </div>
          <div className="panel-scroll">{renderPanel()}</div>
        </aside>

        <section className="stage-column">
          <div className="stage-toolbar">
            <div>
              <strong>{activeScene?.title}</strong>
              <span>요소를 누르고 끌어서 움직여 보세요.</span>
            </div>
            <div className="scene-tools">
              <button type="button" onClick={copyActiveScene} disabled={project.scenes.length >= MAX_SCENES}>장면 복사</button>
              <button type="button" onClick={deleteActiveScene} disabled={project.scenes.length === 1}>장면 삭제</button>
            </div>
          </div>

          <div className="stage-surround">
            <div
              ref={stageRef}
              className="stage-board"
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={pointerUp}
              onPointerDown={(event) => {
                if (event.currentTarget === event.target) setSelectedId(undefined);
              }}
            >
              {activeScene ? <StageBackdrop backgroundId={activeScene.backgroundId} /> : null}
              <div className="safe-frame" aria-hidden="true" />
              {activeScene?.items.map((item) => (
                <StageItemView
                  key={item.id}
                  item={item}
                  selected={selectedId === item.id}
                  onPointerDown={(event) => pointerDown(event, item)}
                />
              ))}
              {!activeScene?.items.length ? (
                <div className="empty-stage">
                  <span>＋</span>
                  <strong>왼쪽에서 캐릭터와 소품을 골라 보세요.</strong>
                  <p>배경을 먼저 고르면 장면을 만들기 쉬워요.</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="scene-strip" aria-label="장면 목록">
            {project.scenes.map((scene, index) => (
              <button type="button" key={scene.id} className={`scene-card ${scene.id === project.activeSceneId ? "active" : ""}`} onClick={() => switchScene(scene.id)}>
                <span className={`scene-mini background-${scene.backgroundId}`}>
                  <i>{scene.items.filter((item) => item.kind === "character").length}</i>
                </span>
                <span><small>SCENE {String(index + 1).padStart(2, "0")}</small><strong>{scene.title}</strong></span>
              </button>
            ))}
            <button type="button" className="add-scene" onClick={addScene} disabled={project.scenes.length >= MAX_SCENES}>
              <span>＋</span>
              <strong>장면 추가</strong>
              <small>{project.scenes.length}/{MAX_SCENES}</small>
            </button>
          </div>
        </section>

        <Inspector
          item={selectedItem}
          onScale={(delta) => selectedItem && patchSelectedBase({ scale: clamp(selectedItem.scale + delta, 0.45, 1.8) })}
          onRotate={(delta) => selectedItem && patchSelectedBase({ rotation: clamp(selectedItem.rotation + delta, -30, 30) })}
          onLayer={moveSelectedLayer}
          onDuplicate={duplicateSelected}
          onDelete={deleteSelected}
          onCharacterChange={(patch) => patchSelectedData(patch)}
          onSpeechChange={(patch, record) => patchSelectedData(patch, record)}
        />
      </section>

      <footer className="app-footer">
        <span><b>1</b> 캐릭터 만들기</span><i>→</i><span><b>2</b> 무대 꾸미기</span><i>→</i><span><b>3</b> 대사 넣기</span><i>→</i><span><b>4</b> 발표하기</span>
      </footer>

      {presentationOpen && activeScene ? (
        <div className="presentation-layer" role="dialog" aria-modal="true" aria-label="연극 발표 화면">
          <div className="presentation-topbar">
            <div><small>MOAKIT PLAY · 발표 모드</small><strong>{project.title}</strong></div>
            <button type="button" onClick={() => setPresentationOpen(false)}>편집으로 돌아가기 ×</button>
          </div>
          <div className="presentation-stage">
            <div className="stage-board read-only">
              <StageBackdrop backgroundId={activeScene.backgroundId} />
              {activeScene.items.map((item) => <StageItemView key={item.id} item={item} />)}
            </div>
          </div>
          <div className="presentation-scenes">
            {project.scenes.map((scene, index) => (
              <button type="button" key={scene.id} className={scene.id === project.activeSceneId ? "active" : ""} onClick={() => switchScene(scene.id)}>{index + 1}</button>
            ))}
          </div>
        </div>
      ) : null}
    </main>
  );
}
