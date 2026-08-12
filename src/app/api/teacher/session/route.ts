import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import {
  isTeacherAuthenticated,
  TEACHER_COOKIE_NAME,
  teacherSessionToken,
} from "@/lib/auth/teacher-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  return NextResponse.json({ authenticated: await isTeacherAuthenticated() });
}

export async function POST(request: Request) {
  const { code } = await request.json() as { code?: string };
  const configuredCode = process.env.TEACHER_ADMIN_CODE || "STAGE2026";
  let authenticated = code === configuredCode;
  if (!authenticated && code) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const codeHash = createHash("sha256").update(code).digest("hex");
      const { data } = await admin.from("drama_classes").select("id").eq("admin_code_hash", codeHash).limit(1).maybeSingle();
      authenticated = Boolean(data);
    }
  }
  if (!authenticated) return NextResponse.json({ error: "관리자 코드를 확인해 주세요." }, { status: 401 });
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(TEACHER_COOKIE_NAME,teacherSessionToken(),{httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV === "production",maxAge:60*60*8,path:"/"});
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated:false });
  response.cookies.delete(TEACHER_COOKIE_NAME);
  return response;
}
