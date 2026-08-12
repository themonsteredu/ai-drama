import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { TeacherPortal } from "@/components/teacher/teacher-portal";

export const metadata: Metadata = { title: "교사 운영실" };
export default function TeacherPage() { return <><SiteHeader compact/><TeacherPortal/></>; }
