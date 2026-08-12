import type { Metadata } from "next";
import { StudioShell } from "@/components/student/studio-shell";

export const metadata: Metadata = { title: "학생 제작 스튜디오" };

export default async function StudentStudioPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  return <StudioShell teamId={teamId}/>;
}
