"use client";

import { useState } from "react";

/**
 * 종목 로고. 토스 아이콘 CDN에 실제로 존재하는 티커만 화이트리스트로 관리한다.
 * 목록에 없거나 로드에 실패하면 종목 색을 쓴 모노그램으로 떨어진다.
 *
 * 화이트리스트를 쓰는 이유: CDN이 티커만 보고 응답하기 때문에 BA(보잉)를
 * BA.L(BAE Systems)로 잘못 붙이는 사고가 난다. 유럽·대만 상장은 아예 없다.
 */
/**
 * 자체 호스팅 로고 — 토스 CDN에 없는 종목. `public/logos/`에 둔다.
 * 투명 PNG라 `.logo`의 --logo-bg가 배경이 되어 라이트·다크 양쪽에 맞는다.
 * CDN보다 먼저 본다 (외부 CDN이 죽어도 안 깨진다).
 */
const LOCAL: Record<string, string> = {
  RBRK: "/logos/RBRK.png", // 토스 CDN 403 — 자산 자체가 없다
};

const CDN: Record<string, string> = {
  VT: "VT", MSFT: "MSFT", META: "META", INTC: "INTC", QCOM: "QCOM",
  AAPL: "AAPL", DELL: "DELL", HPQ: "HPQ", XOM: "XOM", CVX: "CVX", SHEL: "SHEL",
  TLT: "TLT", IEF: "IEF", JPM: "JPM", BAC: "BAC", XLF: "XLF",
  SGOV: "SGOV", KRE: "KRE", EUAD: "EUAD", "005930": "005930", "000660": "000660",
  // 오늘의 분석 관심 종목 (미보유) — 토스 CDN에 존재 확인된 미국 대형주
  NVDA: "NVDA", TSM: "TSM", AVGO: "AVGO", AMD: "AMD", MU: "MU", ASML: "ASML",
  GOOGL: "GOOGL", AMZN: "AMZN", ORCL: "ORCL", COP: "COP", SLB: "SLB", GS: "GS", MS: "MS",
  MRVL: "MRVL", CRWD: "CRWD", // RBRK는 LOCAL에 있고, ALM(Almonty)은 토스 CDN 미확인 — 모노그램 폴백
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
  any = false,
}: {
  ticker: string;
  name: string;
  color: string;
  size?: number;
  /**
   * 화이트리스트 밖의 티커도 CDN을 시도한다 — 캘린더 어닝처럼 미국 상장 티커만 들어오는 자리용.
   * 알파벳만으로 된 티커로 제한해 BA.L 같은 해외 오매칭을 피한다. 실패하면 모노그램.
   */
  any?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const local = LOCAL[ticker];
  const code = CDN[ticker] ?? (any && /^[A-Z]{1,5}$/.test(ticker) ? ticker : undefined);
  const src = local ?? (code ? `https://static.toss.im/png-icons/securities/icn-sec-fill-${code}.png` : undefined);
  const label = MONO[ticker] ?? ticker.replace(/\..*$/, "").slice(0, 3);

  if (!src || failed) {
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
      src={src}
      alt=""
      width={size}
      height={size}
      decoding="async"
      // SSR된 <img>는 하이드레이션 전에 이미 로드가 끝날 수 있다. 그때 난 에러는
      // onError로 안 잡히므로(핸들러가 아직 안 붙었다) 마운트 시점에 한 번 더 본다.
      ref={(el) => { if (el?.complete && el.naturalWidth === 0) setFailed(true); }}
      onError={() => setFailed(true)}
      title={name}
    />
  );
}
