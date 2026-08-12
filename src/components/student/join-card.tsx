"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Clapperboard, KeyRound, Radio, Users } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { joinTeamWithSupabase } from "@/lib/supabase/team-repository";
import { useStudioStore } from "@/store/studio-store";

const demoTeams = [
  { code: "MOON24", team: "달빛극단", names: "민서 · 지후 · 서윤 · 도현" },
  { code: "WAVE55", team: "물결스튜디오", names: "하린 · 준서 · 유나 · 시우 · 채원" },
  { code: "STAR66", team: "별무대", names: "예준 · 소율 · 현우 · 다은 · 건우 · 지아" },
];

function friendlyJoinError(cause: unknown) {
  const raw = cause instanceof Error
    ? cause.message
    : typeof cause === "object" && cause && "message" in cause && typeof cause.message === "string"
      ? cause.message
      : "입장에 실패했습니다.";
  if (raw.includes("Anonymous sign-ins are disabled")) return "학생 익명 입장이 아직 열리지 않았습니다. 교사에게 Supabase 로그인 설정 확인을 요청해 주세요.";
  if (raw.includes("Team is full")) return "이 모둠은 정원이 찼습니다. 이미 등록된 학생이라면 활동지에 적은 이름과 똑같이 입력해 주세요.";
  if (raw.includes("Student name is required")) return "이름을 입력해 주세요.";
  if (raw.toLowerCase().includes("invalid") || raw.toLowerCase().includes("not found")) return "모둠 코드가 맞는지 다시 확인해 주세요.";
  return raw;
}

export function JoinCard() {
  const router = useRouter();
  const joinTeam = useStudioStore((state) => state.joinTeam);
  const connectRemoteTeam = useStudioStore((state) => state.connectRemoteTeam);
  const [code, setCode] = useState("MOON24");
  const [name, setName] = useState("민서");
  const [message, setMessage] = useState("");
  const [joining, setJoining] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    if (isSupabaseConfigured()) {
      setJoining(true);
      try {
        const remote = await joinTeamWithSupabase(code, name);
        connectRemoteTeam(remote.team, remote.studentId);
        router.push(`/student/${remote.team.id}`);
      } catch (cause) {
        setMessage(friendlyJoinError(cause));
      } finally {
        setJoining(false);
      }
      return;
    }
    const result = joinTeam(code, name);
    setMessage(result.message);
    if (result.ok && result.teamId) router.push(`/student/${result.teamId}`);
  }

  return (
    <section className="overflow-hidden border border-[var(--line)] bg-white shadow-[0_24px_70px_rgba(16,24,40,.12)]">
      <div className="grid lg:grid-cols-[.88fr_1.12fr]">
        <div className="studio-grid flex min-h-[620px] flex-col justify-between bg-[#101828] p-7 text-white md:p-10">
          <div>
            <div className="flex items-center gap-3 border-b border-white/10 pb-5">
              <span className="grid size-11 place-items-center rounded-lg bg-blue-600"><Clapperboard size={21}/></span>
              <div><p className="text-[10px] font-bold tracking-[.2em] text-blue-300">STUDENT CALL SHEET</p><strong className="mt-1 block">오늘의 촬영 스튜디오</strong></div>
            </div>
            <p className="mt-12 text-xs font-bold tracking-[.18em] text-white/45">YOUR PRODUCTION STARTS HERE</p>
            <h1 className="display-serif mt-4 text-4xl leading-[1.12] md:text-5xl">같은 코드를 입력하면,<br/>같은 무대가 열립니다.</h1>
            <p className="mt-6 max-w-md text-sm leading-7 text-white/60">선생님이 알려준 모둠 코드로 친구들과 연결됩니다. 작품 선택부터 촬영까지 하나의 제작 보드에서 함께 진행하세요.</p>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-1">
            <span className="flex items-center gap-3 border-t border-white/10 pt-4"><Check className="text-emerald-300" size={16}/> 전원 배우로 출연</span>
            <span className="flex items-center gap-3 border-t border-white/10 pt-4"><Users className="text-blue-300" size={16}/> 실시간 공동 편집</span>
            <span className="flex items-center gap-3 border-t border-white/10 pt-4"><Radio className="text-amber-300" size={16}/> 컷별 촬영 후 자동 완성</span>
          </div>
        </div>

        <div className="p-7 md:p-10 lg:p-12">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-blue-50 text-[var(--wine)]"><KeyRound size={19}/></span><div><p className="eyebrow">TEAM ACCESS</p><h2 className="text-xl font-extrabold">모둠 입장</h2></div></div>
          <form onSubmit={(event) => void submit(event)} className="mt-9">
            <label className="block text-sm font-bold" htmlFor="team-code">모둠 코드</label>
            <input id="team-code" className="input mt-2 uppercase tracking-[.18em]" value={code} maxLength={8} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="예: MOON24" required autoComplete="off"/>
            <label className="mt-5 block text-sm font-bold" htmlFor="student-name">내 이름</label>
            <input id="student-name" className="input mt-2" value={name} onChange={(event) => setName(event.target.value)} placeholder="이름" required autoComplete="name"/>
            <button className="btn btn-primary mt-6 w-full" type="submit" disabled={joining}>{joining ? "모둠 연결 중…" : "제작 스튜디오 입장"} <ArrowRight size={18}/></button>
            {message ? <p role="alert" className="mt-4 border border-red-200 bg-red-50 p-3 text-sm font-semibold leading-6 text-red-700">{message}</p> : null}
          </form>

          <div className="mt-10 border-t border-[var(--line)] pt-7">
            <div className="flex items-end justify-between gap-3"><div><p className="eyebrow">QUICK DEMO</p><h3 className="mt-1 font-extrabold">샘플 모둠 선택</h3></div><span className="text-xs text-[var(--muted)]">클릭하면 자동 입력</span></div>
            <div className="mt-4 grid gap-2">
              {demoTeams.map((demo) => (
                <button key={demo.code} type="button" onClick={() => { setCode(demo.code); setName(demo.names.split(" · ")[0]); setMessage(""); }} className="focus-ring group grid w-full grid-cols-[1fr_auto] items-center gap-4 border border-[var(--line)] p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/50">
                  <span><strong className="block text-sm">{demo.team}</strong><small className="mt-1 block text-[var(--muted)]">{demo.names}</small></span>
                  <code className="bg-[var(--paper-deep)] px-2 py-1 text-xs font-black text-[var(--wine)] group-hover:bg-white">{demo.code}</code>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
