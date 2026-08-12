import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GalleryPlaylist } from "@/components/teacher/gallery-playlist";
import { isTeacherAuthenticated } from "@/lib/auth/teacher-session";

export const metadata: Metadata = { title: "전체 작품 상영" };
export default async function TeacherGalleryPage() {
  if (!(await isTeacherAuthenticated())) redirect("/teacher");
  return <GalleryPlaylist/>;
}
