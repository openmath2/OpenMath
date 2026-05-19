import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenMath — 수학 문제 생성 플랫폼",
  description:
    "OpenMath 하나로 중등 수학 동형문제를 정확하게 출제하세요. AI가 만들고 SymPy가 증명한 수학 문제.",
  metadataBase: new URL("https://openmath.example"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Noto+Serif+KR:wght@300;400;500;600&family=Noto+Sans+KR:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
