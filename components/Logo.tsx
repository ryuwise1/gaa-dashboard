"use client";

import { useState } from "react";

/**
 * 종목 로고. 토스 아이콘 CDN에 실제로 존재하는 티커만 화이트리스트로 관리한다.
 * 목록에 없거나 로드에 실패하면 종목 색을 쓴 모노그램으로 떨어진다.
 *
 * 화이트리스트를 쓰는 이유: CDN이 티커만 보고 응답하기 때문에 BA(보잉)를
 * BA.L(BAE Systems)로 잘못 붙이는 사고가 난다. 유럽·대만 상장은 아예 없다.
 */
const CDN: Record<string, string> = {
  VT: "VT", MSFT: "MSFT", META: "META", INTC: "INTC", QCOM: "QCOM",
  AAPL: "AAPL", DELL: "DELL", HPQ: "HPQ", XOM: "XOM", CVX: "CVX", SHEL: "SHEL",
  TLT: "TLT", IEF: "IEF", JPM: "JPM", BAC: "BAC", XLF: "XLF",
  SGOV: "SGOV", KRE: "KRE", EUAD: "EUAD", "005930": "005930", "000660": "000660",
  // 오늘의 분석 관심 종목 (미보유) — 토스 CDN에 존재 확인된 미국 대형주
  NVDA: "NVDA", TSM: "TSM", AVGO: "AVGO", AMD: "AMD", MU: "MU", ASML: "ASML",
  GOOGL: "GOOGL", AMZN: "AMZN", ORCL: "ORCL", COP: "COP", SLB: "SLB", GS: "GS", MS: "MS",
};

/** 모노그램에 쓸 짧은 글자 — 로고가 없는 종목용 */
const MONO: Record<string, string> = {
  TTE: "TT", "2454.TW": "MTK",
};

/**
 * 모노그램 글자색을 배경 밝기로 정한다.
 * 시리즈 색에는 노랑(#ffc233)처럼 밝은 색이 있어서 흰 글씨를 고정하면 안 읽힌다.
 * CSS 변수(var(--s4))로 들어오므로 실제 값을 읽어서 계산한다.
 */
function inkOn(cssColor: string): string {
  if (typeof window === "undefined") return "#fff";
  const name = cssColor.match(/var\((--[\w-]+)\)/)?.[1];
  const raw = name
    ? getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    : cssColor;
  const hex = raw.replace("#", "");
  if (hex.length !== 6) return "#fff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const lum = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  // 흰색·먹색 중 대비가 더 높은 쪽. 고정 임계값을 쓰면 중간 밝기 색에서 아슬아슬해진다.
  const onWhite = 1.05 / (lum + 0.05);
  const onInk = (lum + 0.05) / 0.0614;
  return onInk >= onWhite ? "#17171c" : "#ffffff";
}

export default function Logo({
  ticker,
  name,
  color,
  size = 30,
}: {
  ticker: string;
  name: string;
  color: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const code = CDN[ticker];
  const label = MONO[ticker] ?? ticker.replace(/\..*$/, "").slice(0, 3);

  if (!code || failed) {
    return (
      <span
        className="logo logo-mono"
        style={{
          width: size, height: size, background: color, color: inkOn(color),
          fontSize: label.length > 2 ? 9 : 11,
        }}
        aria-hidden
      >
        {label}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="logo"
      src={`https://static.toss.im/png-icons/securities/icn-sec-fill-${code}.png`}
      alt=""
      width={size}
      height={size}
      decoding="async"
      onError={() => setFailed(true)}
      title={name}
    />
  );
}
