"use client";

import { useMemo, useState } from "react";
import Logo from "@/components/Logo";
import { HOLDINGS, fmtUsd, fmtLocalPrice, tickerColorVar, type QuoteMap } from "@/lib/portfolio";
import { cashUsd } from "@/lib/trades";
import { marketOfCurrency, marketStatus } from "@/lib/market";
import ACTIONS from "@/data/actions.json";

/** 서울 기준 오늘 (YYYY-MM-DD) — 브라우저 시간대가 달라도 체결일이 밀리지 않게 */
function todaySeoul(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

interface Result {
  commit: string;
  trade: { ticker: string; side: string; qty: number; price: number; usd: number };
  position: { qty: number; avgPrice: number; status: string };
  cashAfter: number;
  clearedActions: number;
}

/**
 * 보드에서 매매를 기록하는 폼 (팀 전용).
 *
 * 여기서 받는 건 체결 정보뿐이다 — 수량·평단·상태는 서버가 원장을 리플레이해서
 * `holdings.json`에 파생시킨다. 사람이 holdings를 직접 고칠 일이 없어야
 * 원장과 보유가 어긋나지 않는다 (`tools/check-ledger.mjs`가 잡는 그 어긋남).
 */
export default function TradeForm({ quotes }: { quotes: QuoteMap }) {
  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState("");
  const [side, setSide] = useState<"매수" | "매도">("매수");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(todaySeoul());
  const [note, setNote] = useState("");
  const [secret, setSecret] = useState("");
  const [clearIds, setClearIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Result | null>(null);

  const pos = HOLDINGS.positions.find((p) => p.ticker === ticker);
  const quote = pos ? quotes[pos.yahoo] : undefined;
  const live = quote?.price ?? null;
  const qtyNum = Number(qty);
  const priceNum = Number(price);

  // 원화 종목은 환산해서 달러로 보여준다 — 현금·비중이 전부 달러 기준이라
  const usdkrw = quotes["KRW=X"]?.price ?? null;
  const estUsd = useMemo(() => {
    if (!pos || !Number.isFinite(qtyNum) || !Number.isFinite(priceNum)) return null;
    const fx = pos.currency === "USD" ? 1 : pos.currency === "KRW" ? (usdkrw ? 1 / usdkrw : null) : null;
    return fx == null ? null : qtyNum * priceNum * fx;
  }, [pos, qtyNum, priceNum, usdkrw]);

  const market = pos ? marketStatus(marketOfCurrency(pos.currency), new Date()) : null;
  const pending = (ACTIONS as { items: { id: string; text: string; type: string }[] }).items
    .filter((i) => i.type === "집행 예정");

  const problems: string[] = [];
  if (pos && side === "매도" && Number.isFinite(qtyNum) && qtyNum > (pos.qty ?? 0)) {
    problems.push(`보유 ${(pos.qty ?? 0).toLocaleString()}주보다 많이 팔 수 없습니다.`);
  }
  if (side === "매수" && estUsd != null && estUsd > cashUsd) {
    problems.push(`가용 현금 ${fmtUsd(cashUsd)}를 넘습니다.`);
  }
  if (pos && pos.currency !== "USD" && pos.currency !== "KRW") {
    problems.push(`${pos.currency} 종목은 보드에서 기록할 수 없습니다 — 원장에 직접 적어주세요.`);
  }
  // 버튼이 꺼져 있으면 왜 꺼져 있는지 반드시 화면에 말해야 한다.
  // 이유 없는 비활성 버튼은 "안 된다"는 인상만 주고 사용자를 막아세운다.
  const missing: string[] = [];
  if (!pos) missing.push("종목");
  if (!(Number.isFinite(qtyNum) && qtyNum > 0)) missing.push("수량");
  if (!(Number.isFinite(priceNum) && priceNum > 0)) missing.push("체결가");
  const noteLeft = 10 - note.trim().length;
  if (noteLeft > 0) missing.push(`체결 근거 ${noteLeft}자 더`);
  if (!secret) missing.push("집행 비밀번호");
  const ready = missing.length === 0 && problems.length === 0;

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret, date, ticker, side, qty: qtyNum, price: priceNum,
          note: note.trim(), clearActionIds: clearIds,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) { setError(j.error ?? `오류 ${res.status}`); return; }
      setDone(j);
      setQty(""); setPrice(""); setNote(""); setSecret(""); setClearIds([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청이 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="tf-open">
        <button onClick={() => { setOpen(true); setDone(null); }}>＋ 매매 기록</button>
        <span className="meta">가용 현금 {fmtUsd(cashUsd)}</span>
      </div>
    );
  }

  return (
    <section className="tf" aria-label="매매 기록">
      <div className="tf-head">
        <b>매매 기록</b>
        <span className="meta">기록하면 저장소에 커밋되고 1분 안에 보드에 반영됩니다</span>
        <button className="tf-x" onClick={() => setOpen(false)} aria-label="닫기">✕</button>
      </div>

      {done ? (
        <div className="tf-done">
          <p>
            <b>{done.trade.ticker} {done.trade.side} {done.trade.qty.toLocaleString()}주</b> 기록했습니다
            {" "}· 커밋 <code>{done.commit}</code>
          </p>
          <p className="meta">
            보유 {done.position.qty.toLocaleString()}주 · 평단{" "}
            {fmtLocalPrice((pos?.currency ?? "USD") as never, done.position.avgPrice)} · {done.position.status}
            {" "}· 가용 현금 {fmtUsd(done.cashAfter)}
            {done.clearedActions > 0 && <> · 오늘 할 일 {done.clearedActions}건 정리</>}
          </p>
          <p className="meta">재배포가 끝나면 새로고침해서 확인하세요.</p>
          <button onClick={() => setDone(null)}>계속 기록</button>
        </div>
      ) : (
        <>
          <div className="tf-grid">
            <label>
              <span>종목</span>
              <select value={ticker} onChange={(e) => { setTicker(e.target.value); setPrice(""); }}>
                <option value="">— 고르세요 —</option>
                {HOLDINGS.positions.map((p) => (
                  <option key={p.ticker} value={p.ticker}>
                    {p.name} ({p.ticker}){p.qty ? ` · ${p.qty.toLocaleString()}주` : " · 미보유"}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>구분</span>
              <div className="tf-side">
                {(["매수", "매도"] as const).map((s) => (
                  <button key={s} data-on={side === s || undefined} onClick={() => setSide(s)}>{s}</button>
                ))}
              </div>
            </label>

            <label>
              <span>체결일</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>

            <label>
              <span>수량</span>
              <input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ""))} placeholder="주" />
            </label>

            <label>
              <span>체결가 {pos && <i className="tf-cur">{pos.currency}</i>}</span>
              <div className="tf-price">
                <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="실제 체결가" />
                {live != null && (
                  <button type="button" onClick={() => setPrice(String(live))} title="현재가를 넣습니다 — 실제 체결가로 반드시 고치세요">
                    현재가 {fmtLocalPrice(pos!.currency, live)}
                  </button>
                )}
              </div>
            </label>

            <label className="tf-wide">
              <span>
                체결 근거 <i className="meta">— 나중에 우리가 읽을 기록입니다</i>
                <i className={`tf-count${noteLeft > 0 ? " short" : ""}`}>
                  {noteLeft > 0 ? `${noteLeft}자 더` : `${note.trim().length}자`}
                </i>
              </span>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="왜 이 시점에 이 수량인지. 반증 조건이 있으면 같이 적으세요." />
            </label>
          </div>

          {pos && market && !market.open && (
            <p className="tf-warn">
              지금 {market.label}은 <b>마감</b> 상태입니다 ({market.hint}). 장중 체결가가 아니라면
              평단이 틀어지고 수익률·비중까지 번집니다 — 실제 체결가가 맞는지 확인하세요.
            </p>
          )}
          {problems.map((p) => <p key={p} className="tf-err">{p}</p>)}

          {estUsd != null && (
            <p className="tf-sum num">
              {side} {qtyNum.toLocaleString()}주 × {fmtLocalPrice(pos!.currency, priceNum)} ={" "}
              <b>{fmtUsd(estUsd, 2)}</b>
              <span className="meta"> · 기록 후 현금 {fmtUsd(side === "매수" ? cashUsd - estUsd : cashUsd + estUsd)}</span>
            </p>
          )}

          {pending.length > 0 && (
            <div className="tf-actions">
              <span className="meta">완료 처리할 &ldquo;오늘 할 일&rdquo;</span>
              {pending.map((i) => (
                <label key={i.id} className="tf-chk">
                  <input type="checkbox" checked={clearIds.includes(i.id)}
                    onChange={(e) => setClearIds((c) => e.target.checked ? [...c, i.id] : c.filter((x) => x !== i.id))} />
                  {i.text}
                </label>
              ))}
            </div>
          )}

          <div className="tf-submit">
            <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)}
              placeholder="집행 비밀번호" autoComplete="off" />
            <button disabled={!ready || busy} onClick={submit}>
              {busy ? "기록 중…" : "원장에 기록"}
            </button>
          </div>
          {missing.length > 0 && (
            <p className="tf-missing">아직 못 채운 항목: {missing.join(" · ")}</p>
          )}
          {error && <p className="tf-err">{error}</p>}
          {pos && (
            <p className="tf-preview meta">
              <Logo ticker={pos.ticker} name={pos.name} color={tickerColorVar(pos.ticker, 0)} size={18} />
              {pos.name} · 현재 {(pos.qty ?? 0).toLocaleString()}주 · 목표 {fmtUsd(pos.targetUsd)} · {pos.status}
            </p>
          )}
        </>
      )}
    </section>
  );
}
