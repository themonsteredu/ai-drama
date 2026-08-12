import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "문학이 무대가 되는 순간", template: "%s | 문학이 무대가 되는 순간" },
  description: "고전문학을 직접 각색하고 연기하고 촬영해 완성하는 교실용 영상연극 제작소",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
