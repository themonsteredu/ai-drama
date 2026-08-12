import { notFound } from "next/navigation";
import { PrintToolbar } from "@/components/worksheet/print-toolbar";
import { Worksheet } from "@/components/worksheet/worksheet";
import { CLASSIC_WORKS } from "@/lib/seed";
import type { TeamSize, WorkId } from "@/lib/types";

interface WorksheetPageProps {
  params: Promise<{ workId: string; size: string }>;
  searchParams: Promise<{ answers?: string }>;
}

export default async function WorksheetPage({ params, searchParams }: WorksheetPageProps) {
  const { workId, size } = await params;
  const { answers } = await searchParams;
  const parsedSize = Number(size) as TeamSize;
  if (!CLASSIC_WORKS.some((work) => work.id === workId) || ![4, 5, 6].includes(parsedSize)) notFound();
  const showAnswers = answers === "1";
  return <main className="py-8"><PrintToolbar workId={workId as WorkId} size={parsedSize} showAnswers={showAnswers}/><Worksheet workId={workId as WorkId} size={parsedSize} showAnswers={showAnswers}/></main>;
}
