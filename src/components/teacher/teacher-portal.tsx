"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { TeacherDashboard } from "@/components/teacher/teacher-dashboard";
import { TeacherLogin } from "@/components/teacher/teacher-login";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useStudioStore } from "@/store/studio-store";

export function TeacherPortal() {
  const needsRemoteDashboard = isSupabaseConfigured();
  const [authenticated, setAuthenticated] = useState<boolean>();
  const [dashboardReady, setDashboardReady] = useState(!needsRemoteDashboard);
  const [loadError, setLoadError] = useState("");
  const replaceClassroom = useStudioStore((state) => state.replaceClassroom);

  useEffect(() => {
    fetch("/api/teacher/session")
      .then((response) => response.json())
      .then((body) => setAuthenticated(Boolean(body.authenticated)))
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (authenticated !== true || !needsRemoteDashboard) return;
    const controller = new AbortController();
    void fetch("/api/teacher/dashboard", { signal: controller.signal }).then(async (response) => {
      const body = await response.json() as { classroom?: Parameters<typeof replaceClassroom>[0]; error?: string };
      if (!response.ok || !body.classroom) throw new Error(body.error ?? "수업 정보를 불러오지 못했습니다.");
      replaceClassroom(body.classroom);
      setDashboardReady(true);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(error instanceof Error ? error.message : "수업 정보를 불러오지 못했습니다.");
    });
    return () => controller.abort();
  }, [authenticated, needsRemoteDashboard, replaceClassroom]);

  if (authenticated === undefined || (authenticated && !dashboardReady && !loadError)) {
    return <main className="grid min-h-[70vh] place-items-center text-center"><div><LoaderCircle className="mx-auto animate-spin text-[var(--wine)]" size={30}/><p className="mt-3 text-sm font-bold text-[var(--muted)]">확정된 수업과 모둠 코드를 불러오는 중</p></div></main>;
  }
  if (loadError) return <main className="shell grid min-h-[70vh] place-items-center"><section className="paper-card max-w-lg rounded-3xl p-8 text-center"><h2 className="text-2xl font-extrabold">수업 정보를 불러오지 못했어요</h2><p className="mt-3 text-sm text-red-700">{loadError}</p><button type="button" className="btn btn-primary mt-6" onClick={() => window.location.reload()}>다시 불러오기</button></section></main>;
  return authenticated ? <TeacherDashboard/> : <TeacherLogin onAuthenticated={() => setAuthenticated(true)}/>;
}
