import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://gaa-dashboard-eight.vercel.app"),
  title: "GLIF 자산운용팀 포트폴리오",
  description: "성균관대 금융투자학회 GLIF 26-2 자산운용팀 실시간 운용 현황 · 매매 내역 · 투자 근거",
  robots: { index: false, follow: false },
  // 카톡·슬랙 등 링크 미리보기 — 없으면 스크래퍼가 페이지 안의 아무 이미지(종목 로고)를 집어간다
  openGraph: {
    title: "GLIF 자산운용팀 포트폴리오",
    description: "GLIF 26-2 실시간 운용 현황 · 매매 내역 · 투자 근거",
    siteName: "GLIF 26-2 자산운용팀",
    type: "website",
    images: [{ url: "/og-v2.jpg", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/og-v2.jpg"] },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💸</text></svg>",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

/**
 * 첫 페인트 전에 저장된 테마를 입혀 깜빡임을 막는다.
 * 저장값이 없으면 라이트가 기본 — 시스템 설정을 따라가지 않는다.
 */
const THEME_INIT = `(function(){try{var t=localStorage.getItem('gaa-theme');
document.documentElement.dataset.theme=(t==='dark'?'dark':'light');}catch(e){
document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-theme="light" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
