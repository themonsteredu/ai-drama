import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.json();
  const webhook = process.env.VIDEO_RENDER_WEBHOOK_URL;
  const secret = process.env.VIDEO_RENDER_WEBHOOK_SECRET;
  if (!webhook) return NextResponse.json({ mode: "browser", message: "서버 렌더 워커가 없어 ffmpeg.wasm 브라우저 합성을 사용합니다." }, { status: 202 });
  const response = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json", ...(secret ? {authorization:`Bearer ${secret}`} : {}) }, body: JSON.stringify(payload) });
  if (!response.ok) return NextResponse.json({ error: "렌더 워커 요청 실패" }, { status: 502 });
  return NextResponse.json(await response.json(), { status: 202 });
}
