import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const TEACHER_COOKIE_NAME = "literature-stage-teacher";

export function teacherSessionToken() {
  return createHash("sha256")
    .update(`${process.env.TEACHER_ADMIN_CODE || "STAGE2026"}:literature-stage`)
    .digest("hex");
}

export function teacherSessionMatches(value?: string) {
  if (!value) return false;
  const expected = Buffer.from(teacherSessionToken());
  const received = Buffer.from(value);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function isTeacherAuthenticated() {
  const cookieStore = await cookies();
  return teacherSessionMatches(cookieStore.get(TEACHER_COOKIE_NAME)?.value);
}
