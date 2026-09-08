/**
 * 원장 ↔ 보유 정합성 검사.
 *
 * `data/holdings.json`의 qty·avgPrice는 `data/trades.json`(기초 보유 + 체결 원장)을
 * 순서대로 재생한 결과와 반드시 같아야 한다. 둘은 자동으로 동기화되지 않는다 —
 * 화면의 평가액은 holdings.qty를, 취득원가는 원장 리플레이를 각각 쓰기 때문에
 * 어긋나면 수익률·비중·기여도가 조용히 틀어진다.
 *
 * 매매를 기록한 뒤 반드시 실행할 것:  node tools/check-ledger.mjs
 * 종료 코드 0 = 일치, 1 = 불일치.
 */
import fs from "fs";

const L = JSON.parse(fs.readFileSync("data/trades.json", "utf8"));
const H = JSON.parse(fs.readFileSync("data/holdings.json", "utf8"));

// 기초 보유분에서 출발해 체결을 날짜순으로 적용한다. 평단은 이동평균법,
// 매도는 수량만 줄이고 평단은 유지한다 (lib/trades.ts의 replay와 같은 규칙).
const book = new Map();
for (const p of L.openingPositions.positions) book.set(p.ticker, { qty: p.qty, avg: p.avgPrice });

const sorted = [...L.trades].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
for (const t of sorted) {
  const b = book.get(t.ticker) ?? { qty: 0, avg: 0 };
  if (t.side === "매수") {
    const q = b.qty + t.qty;
    book.set(t.ticker, { qty: q, avg: (b.qty * b.avg + t.qty * t.price) / q });
  } else {
    book.set(t.ticker, { qty: b.qty - t.qty, avg: b.avg });
  }
}

const problems = [];
for (const p of H.positions) {
  const b = book.get(p.ticker) ?? { qty: 0, avg: 0 };
  const qty = p.qty ?? 0;
  const avg = p.avgPrice ?? 0;
  // 평단은 반올림해서 저장하는 경우가 있어 0.05% 여유를 둔다
  const avgOk = !b.avg || Math.abs(avg - b.avg) < Math.max(0.01, b.avg * 0.0005);
  if (qty !== b.qty || !avgOk) {
    problems.push(
      `${p.ticker.padEnd(8)} holdings qty=${qty} avg=${avg}  ≠  원장 qty=${b.qty} avg=${b.avg.toFixed(4)}`
    );
  }
}

// 원장에는 있는데 holdings에 아예 없는 종목도 잡는다
for (const [ticker, b] of book) {
  if (b.qty > 0 && !H.positions.some((p) => p.ticker === ticker)) {
    problems.push(`${ticker.padEnd(8)} 원장에 ${b.qty}주 있으나 holdings.json에 없음`);
  }
}

if (problems.length) {
  console.error("원장 ↔ 보유 불일치 " + problems.length + "건\n");
  for (const p of problems) console.error("  " + p);
  console.error("\nholdings.json의 qty·avgPrice를 원장 기준으로 맞출 것.");
  process.exit(1);
}

console.log(`원장 ↔ 보유 일치 ✅  (종목 ${H.positions.length} · 체결 ${L.trades.length}건)`);
