import { getWork } from "@/lib/seed";
import type { TeamSize, WorkId } from "@/lib/types";

interface WorksheetProps {
  workId: WorkId;
  size: TeamSize;
  showAnswers?: boolean;
}

export function Worksheet({ workId, size, showAnswers = false }: WorksheetProps) {
  const work = getWork(workId)!;
  const variant = work.variants[size];

  return (
    <div className="mx-auto w-fit">
      <section className="worksheet-page paper-card relative min-h-[297mm] w-[210mm] p-[14mm]">
        <header className="border-b-2 border-black pb-5">
          <p className="text-xs font-black tracking-[.2em]">고전문학 영상연극 제작 활동지 · {size}인용</p>
          <div className="mt-3 flex items-end justify-between">
            <div><h1 className="display-serif text-4xl font-bold">{work.title}</h1><p className="mt-2 text-xl font-bold text-[var(--wine)]">{work.highlightTitle}</p></div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm"><span>학교/반 __________________</span><span>모둠명 __________________</span><span>작성일 __________________</span><span>모둠 코드 ______________</span></div>
          </div>
        </header>

        <section className="mt-6">
          <h2 className="text-lg font-extrabold">1. 장면을 이해해요</h2>
          <p className="mt-2 rounded-xl border border-black/20 p-4 text-sm leading-7">{work.easyContext}<br/><strong>오늘의 장면:</strong> {work.sceneContext}</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <BlankBox title="이 장면에서 가장 중요한 갈등은?" />
            <BlankBox title="관객에게 전하고 싶은 것은?" />
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">2. 전원 배우 + 전원 제작자</h2><span className="text-xs font-bold">필요하면 새 배역을 직접 추가해도 됩니다.</span></div>
          <table className="mt-3 w-full border-collapse text-sm">
            <thead><tr className="bg-black/5"><th className="border border-black/25 p-2">학생 이름</th><th className="border border-black/25 p-2">등장인물</th><th className="border border-black/25 p-2">성격·행동 힌트</th><th className="border border-black/25 p-2">제작 역할</th></tr></thead>
            <tbody>{variant.characters.map((character) => <tr key={character.id}><td className="h-14 border border-black/25 p-2"/><td className="border border-black/25 p-2 font-bold">{character.name}</td><td className="border border-black/25 p-2 text-xs">{character.personality.join(" · ")}<br/>{character.actionCue}</td><td className="border border-black/25 p-2"/></tr>)}</tbody>
          </table>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-4">
          <div><h2 className="text-lg font-extrabold">3. 필요한 소품</h2><p className="mt-2 rounded-xl border border-black/20 p-3 text-sm">추천: {work.props.join(" · ")}</p><div className="mt-2 h-20 rounded-xl border border-black/20"/></div>
          <div><h2 className="text-lg font-extrabold">4. 음악 분위기</h2><p className="mt-2 rounded-xl border border-black/20 p-3 text-sm">추천: {work.bgmKeywords.join(" · ")}</p><div className="mt-2 h-20 rounded-xl border border-black/20"/></div>
        </section>
        <WorksheetFooter page="1 / 2" />
      </section>

      <section className="worksheet-page paper-card relative min-h-[297mm] w-[210mm] p-[10mm]">
        <header className="flex items-end justify-between border-b-2 border-black pb-4">
          <div><p className="text-xs font-black tracking-[.16em]">SCENE & DIALOGUE WORKSHEET</p><h1 className="display-serif mt-1 text-3xl font-bold">{work.title} · {size}컷 장면보드</h1></div><p className="text-sm">모둠명 __________________</p>
        </header>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold">대사는 정답을 베끼지 않고 우리 모둠의 말로 먼저 창작합니다. 인물의 마음과 장면의 갈등이 드러나게 써 보세요.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {variant.cuts.map((cut) => (
            <article key={cut.order} className="min-h-[77mm] rounded-xl border-2 border-black/25 p-3">
              <div className="flex items-center justify-between"><h2 className="text-base font-extrabold">컷 {cut.order}. {cut.title}</h2><span className="text-[10px] font-bold">확정 □</span></div>
              <div className="mt-2 space-y-1.5 text-[10px]">
                <p><strong>무슨 일이 일어나는가</strong></p><div className="h-8 bg-[repeating-linear-gradient(transparent_0_15px,#ddd_16px)]"/>
                <div className="grid grid-cols-2 gap-2"><p><strong>등장인물</strong><br/>________________________</p><p><strong>감정</strong><br/>________________________</p></div>
                <p className="font-extrabold">창작 대사</p>
                <table className="w-full border-collapse"><tbody>{[0, 1].map((row) => <tr key={row}><td className="w-[28%] border border-black/20 p-1">인물: ______</td><td className="border border-black/20 p-1">대사: ____________________________</td></tr>)}</tbody></table>
                <p><strong>행동·표정:</strong> __________________________________________</p>
                <div className="grid grid-cols-2 gap-2"><p><strong>소품</strong> ______________</p><p><strong>배경</strong> ______________</p></div>
                {showAnswers ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-1.5"><strong>교사용 모범 예시</strong>{cut.modelDialogue.slice(0, 2).map((line, index) => <p key={`${line.speakerCharacterId}-${index}`}><b>{line.speakerName}:</b> “{line.text}” <span className="text-black/60">({line.direction})</span></p>)}</div>
                ) : <p className="rounded-md bg-black/5 p-1.5"><strong>사건 힌트:</strong> {cut.summary}</p>}
              </div>
            </article>
          ))}
        </div>
        <WorksheetFooter page="2 / 2" />
      </section>
    </div>
  );
}

function BlankBox({ title }: { title: string }) {
  return <div className="rounded-xl border border-black/20 p-4"><strong className="text-sm">{title}</strong><div className="mt-3 h-20 bg-[repeating-linear-gradient(transparent_0_25px,#ddd_26px)]"/></div>;
}

function WorksheetFooter({ page }: { page: string }) {
  return <footer className="absolute bottom-[9mm] left-[12mm] right-[12mm] flex justify-between border-t border-black/20 pt-3 text-[10px]"><span>문학이 무대가 되는 순간</span><span>{page}</span></footer>;
}
