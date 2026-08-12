import type { Metadata } from "next";
import { JoinCard } from "@/components/student/join-card";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "학생 입장" };

export default function StudentEntryPage() {
  return <><SiteHeader compact/><main className="shell py-8 md:py-14"><JoinCard/></main></>;
}
