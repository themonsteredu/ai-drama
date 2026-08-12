"use client";

import Link from "next/link";
import { FileCheck2, FilePenLine, Printer, X } from "lucide-react";
import type { TeamSize, WorkId } from "@/lib/types";

export function PrintToolbar({ workId, size, showAnswers }: { workId: WorkId; size: TeamSize; showAnswers: boolean }) {
  const baseUrl = `/worksheet/${workId}/${size}`;
  return (
    <div className="no-print sticky top-3 z-30 mx-auto mb-5 flex w-fit flex-wrap gap-2 rounded-full bg-[var(--ink)] p-2 shadow-xl">
      <button className="btn min-h-10 bg-white text-black" onClick={() => window.print()}><Printer size={16}/> {showAnswers ? "모범답안 인쇄" : "학생용 활동지 인쇄"}</button>
      <Link className="btn min-h-10 bg-white/10 text-white" href={showAnswers ? baseUrl : `${baseUrl}?answers=1`}>{showAnswers ? <FilePenLine size={16}/> : <FileCheck2 size={16}/>} {showAnswers ? "학생용 빈 활동지" : "교사용 모범답안"}</Link>
      <Link className="btn min-h-10 bg-white/10 text-white" href="/student"><X size={16}/> 닫기</Link>
    </div>
  );
}
