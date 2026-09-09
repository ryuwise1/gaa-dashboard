"use client";

/**
 * 종목 설명 블록 — 산업 칩 / 무엇을 하는 곳 / 왜 담았나.
 * 플랜 근거 펼침·보유 현황 펼침·AP·MP 펼침이 같은 구조를 써서 어디서 열어도 같은 모양으로 읽힌다.
 * 가독성 원칙: 본문색(--ink / --ink-2) 13px, 줄 길이 68ch 이내, 라벨만 회색.
 */
export default function WhyBlock({
  industry, about, why, compact = false,
}: {
  industry?: string;
  about?: string;
  why?: string;
  /** 보유 현황 펼침처럼 좁은 자리 — 라벨 없이 정체 한 줄만 */
  compact?: boolean;
}) {
  if (!industry && !about && !why) return null;
  return (
    <div className={`why${compact ? " compact" : ""}`}>
      {industry && <span className="why-ind">{industry}</span>}
      {about && (
        <p className="why-about">
          {!compact && <span className="why-k">무엇을 하는 곳</span>}
          {about}
        </p>
      )}
      {why && (
        <p className="why-why">
          <span className="why-k">왜 담았나</span>
          {why}
        </p>
      )}
    </div>
  );
}
