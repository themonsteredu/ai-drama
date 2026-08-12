import Link from "next/link";
import { ArrowRight, Camera, Check, Music2, Radio, Users } from "lucide-react";
import { CLASSIC_WORKS } from "@/lib/seed";

const flow = [
  ["01", "장면 해석", "활동지에서 인물의 선택과 갈등을 먼저 의논합니다."],
  ["02", "무대 설계", "촬영 구도와 배우 동선, 소품 위치를 함께 맞춥니다."],
  ["03", "컷별 촬영", "모든 팀원이 배우이자 제작자로 직접 촬영합니다."],
  ["04", "자동 완성", "확정한 컷과 음악을 시스템이 한 편의 MP4로 조립합니다."],
];

const boardCuts = [
  ["01", "도움을 청하는 흥부", "확정"],
  ["02", "놀부의 냉정한 거절", "촬영"],
  ["03", "갈등이 폭발하는 순간", "준비"],
  ["04", "흥부의 새로운 결심", "준비"],
];

function StudioBoard() {
  return (
    <div className="studio-grid relative overflow-hidden border border-white/12 bg-[#101828] p-5 text-white shadow-[0_30px_80px_rgba(16,24,40,.28)] md:p-7">
      <div className="flex items-center justify-between border-b border-white/10 pb-4 text-[11px] font-bold tracking-[.16em] text-white/55">
        <span>PRODUCTION BOARD / MOON24</span>
        <span className="flex items-center gap-2 text-emerald-300"><i className="size-2 rounded-full bg-emerald-400" /> 4 ONLINE</span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1.2fr_.8fr]">
        <div className="relative min-h-64 overflow-hidden bg-[#09111f] p-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(244,165,34,.25),transparent_45%)]" />
          <div className="relative flex h-full min-h-56 flex-col justify-between border border-dashed border-white/20 p-4">
            <div className="flex justify-between text-[10px] font-bold text-white/40"><span>SAFE FRAME 16:9</span><span>CUT 02</span></div>
            <div>
              <div className="mb-3 flex items-end justify-center gap-5">
                <span className="h-24 w-14 border border-white/25 bg-[#2251cc]" />
                <span className="h-32 w-16 border border-white/25 bg-[#f4a522]" />
              </div>
              <p className="border-t border-white/10 pt-3 text-sm font-bold">놀부의 냉정한 거절</p>
              <p className="mt-1 text-xs text-white/45">감정 · 분노 / 당혹 / 긴장</p>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          {boardCuts.map(([number, title, status], index) => (
            <div key={number} className={`border p-3 ${index === 1 ? "border-blue-400 bg-blue-500/12" : "border-white/10 bg-white/[.035]"}`}>
              <div className="flex items-center justify-between text-[10px] font-bold tracking-[.12em] text-white/45">
                <span>CUT {number}</span>
                <span className={status === "확정" ? "text-emerald-300" : status === "촬영" ? "text-amber-300" : ""}>{status}</span>
              </div>
              <p className="mt-2 text-xs font-bold leading-5">{title}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/55">
        <span className="flex items-center gap-2"><Radio size={14} className="text-blue-300" /> 실시간 장면보드 동기화</span>
        <span>4 CUTS · 4 CAST</span>
      </div>
    </div>
  );
}

export function HomeHero() {
  return (
    <>
      <section className="shell grid min-h-[680px] items-center gap-12 py-16 lg:grid-cols-[.92fr_1.08fr] lg:py-20">
        <div>
          <span className="eyebrow">CLASSROOM FILM PRODUCTION</span>
          <h1 className="display-serif mt-5 max-w-2xl text-[clamp(2.6rem,5vw,4.75rem)] leading-[1.11] tracking-[-0.035em]">
            고전문학을<br />읽는 데서 끝내지 않는다.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--muted)]">장면을 해석하고, 대사를 고쳐 쓰고, 직접 연기하고 촬영합니다. 복잡한 편집은 시스템이 맡고 학생의 해석과 표현은 화면에 그대로 남습니다.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link className="btn btn-primary" href="/student">모둠 코드로 입장 <ArrowRight size={18} /></Link>
            <Link className="btn btn-secondary" href="/teacher">교사 운영실</Link>
          </div>
          <div className="mt-10 grid max-w-xl grid-cols-3 border-y border-[var(--line)] py-5 text-sm">
            <div><strong className="block text-2xl font-extrabold">6</strong><span className="text-xs text-[var(--muted)]">고전 작품</span></div>
            <div className="border-x border-[var(--line)] px-5"><strong className="block text-2xl font-extrabold">4–6</strong><span className="text-xs text-[var(--muted)]">인원 · 컷</span></div>
            <div className="pl-5"><strong className="block text-2xl font-extrabold">1</strong><span className="text-xs text-[var(--muted)]">완성 영상</span></div>
          </div>
        </div>
        <StudioBoard />
      </section>

      <section className="border-y border-black/8 bg-white py-20">
        <div className="shell">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div><p className="eyebrow">HIGHLIGHT SCENES</p><h2 className="display-serif mt-3 text-4xl md:text-5xl">한 작품, 가장 극적인 한 장면</h2></div>
            <span className="text-sm font-semibold text-[var(--muted)]">4인 · 5인 · 6인용 역할과 컷 자동 구성</span>
          </div>
          <div className="mt-10 grid border-l border-t border-[var(--line)] md:grid-cols-2 lg:grid-cols-3">
            {CLASSIC_WORKS.map((work, index) => (
              <article key={work.id} className="group min-h-60 border-b border-r border-[var(--line)] bg-white p-6 transition hover:z-10 hover:bg-[#f8faff] hover:shadow-xl">
                <div className="flex items-start justify-between"><span className="text-xs font-extrabold tracking-[.16em] text-[var(--muted)]">SCENE {String(index + 1).padStart(2, "0")}</span><span className="h-1.5 w-10" style={{ background: work.color }} /></div>
                <h3 className="display-serif mt-9 text-3xl">{work.title}</h3>
                <p className="mt-3 text-sm font-bold leading-6" style={{ color: work.color }}>{work.highlightTitle}</p>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{work.tagline}</p>
                <span className="mt-6 flex items-center gap-2 text-xs font-bold text-[var(--muted)]"><Check size={14} /> 인원별 장면 템플릿 준비</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="shell py-24">
        <div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr]">
          <div><p className="eyebrow">PRODUCTION FLOW</p><h2 className="display-serif mt-3 text-4xl leading-tight md:text-5xl">어려운 편집 대신,<br />표현에 집중합니다.</h2><p className="mt-5 leading-7 text-[var(--muted)]">교실에서 바로 이해되는 네 단계입니다. 학생은 창작 결정을 내리고, 시스템은 반복 작업을 처리합니다.</p></div>
          <div className="grid border-l border-t border-[var(--line)] sm:grid-cols-2">
            {flow.map(([number, title, body]) => <article key={number} className="min-h-52 border-b border-r border-[var(--line)] bg-white/70 p-6"><span className="text-xs font-black tracking-[.18em] text-[var(--wine)]">{number}</span><h3 className="mt-8 text-xl font-extrabold">{title}</h3><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{body}</p></article>)}
          </div>
        </div>
        <div className="mt-16 flex flex-wrap items-center justify-between gap-5 bg-[#111827] p-7 text-white md:p-9">
          <div><p className="text-xs font-bold tracking-[.16em] text-blue-300">READY TO PRODUCE</p><h2 className="mt-2 text-2xl font-extrabold md:text-3xl">모든 학생이 배우이자 제작자가 됩니다.</h2></div>
          <div className="flex flex-wrap gap-5 text-sm text-white/70"><span className="flex items-center gap-2"><Users size={17}/> 전원 출연</span><span className="flex items-center gap-2"><Camera size={17}/> 컷별 촬영</span><span className="flex items-center gap-2"><Music2 size={17}/> 블라인드 투표</span></div>
        </div>
      </section>
    </>
  );
}
