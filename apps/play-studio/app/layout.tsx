import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOAKIT PLAY | 나만의 연극 만들기",
  description: "아이들이 캐릭터와 무대를 조합해 자기 이야기를 만드는 교육용 연극 창작 스튜디오",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
