import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  replayLedger, deriveStatus,
  type LedgerFile, type LedgerTrade,
} from "@/lib/ledger-core";

/**
 * 보드에서 매매를 기록하는 엔드포인트.
 *
 * 저장소를 그대로 원본으로 둔다 — DB를 따로 두면 JSON과 갈라지고,
 * 그 갈라짐이 2026-08-03 프로덕션 롤백 사고의 구조였다.
 * 여기서는 GitHub에 커밋을 만들고, 그 push가 Vercel 재배포를 부른다.
 * 그래서 커밋 이력이 곧 감사 로그가 된다.
 *
 * 필요한 환경변수 (Vercel):
 *   GAA_TRADE_SECRET  집행 비밀번호. 팀 모드 비밀번호(클라이언트 해시)와 별개다 —
 *                     그건 탭을 가리는 용도라 쓰기를 지킬 수 없다.
 *   GAA_GH_TOKEN      GitHub fine-grained PAT, 이 저장소 contents:write 만.
 *   GAA_REPO          기본 ryuwise1/gaa-dashboard
 *   GAA_BRANCH        기본 main
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPO = process.env.GAA_REPO ?? "ryuwise1/gaa-dashboard";
const BRANCH = process.env.GAA_BRANCH ?? "main";
const API = "https://api.github.com";

const FILES = {
  trades: "data/trades.json",
  holdings: "data/holdings.json",
  actions: "data/actions.json",
  dividends: "data/dividend-ledger.json",
} as const;

interface Position {
  ticker: string;
  name: string;
  currency: string;
  targetUsd: number;
  status: string;
  qty?: number;
  avgPrice?: number;
  [k: string]: unknown;
}
interface Holdings { meta: Record<string, unknown>; positions: Position[] }

function bad(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function gh(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    // 원문에는 저장소 경로·토큰 상태가 들어 있다. 서버 로그에만 남기고
    // 클라이언트에는 status만 들려 보낸다.
    console.error(`GitHub ${init?.method ?? "GET"} ${path} → ${res.status} ${(await res.text()).slice(0, 500)}`);
    const err = new Error(`github_${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** 커밋 시점 고정 — 읽기도 쓰기도 같은 sha를 기준으로 해야 중간에 낀 변경을 덮지 않는다 */
async function readFile(token: string, path: string, ref: string): Promise<string> {
  const j = await gh(`/repos/${REPO}/contents/${encodeURIComponent(path)}?ref=${ref}`, token);
  return Buffer.from(j.content, "base64").toString("utf8");
}

/** 2칸 들여쓰기 + 끝 개행 — 저장소의 기존 포맷과 바이트 단위로 일치한다(리포맷 diff 방지) */
const ser = (o: unknown) => JSON.stringify(o, null, 2) + "\n";

function secretOk(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // 길이가 다르면 timingSafeEqual이 던진다 — 길이 자체도 노출하지 않도록 먼저 해시한다
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function POST(req: Request) {
  const token = process.env.GAA_GH_TOKEN;
  const secret = process.env.GAA_TRADE_SECRET;
  if (!token || !secret) {
    return bad(503, "서버에 GAA_GH_TOKEN·GAA_TRADE_SECRET이 설정되지 않았습니다. Vercel 환경변수를 확인하세요.");
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return bad(400, "본문이 JSON이 아닙니다."); }

  const given = String(body.secret ?? "");
  if (!given || !secretOk(given, secret)) return bad(401, "집행 비밀번호가 맞지 않습니다.");

  const ticker = String(body.ticker ?? "").trim();
  const side = String(body.side ?? "");
  const qty = Number(body.qty);
  const price = Number(body.price);
  const note = String(body.note ?? "").trim();
  const date = String(body.date ?? "").trim();
  const clear: string[] = Array.isArray(body.clearActionIds) ? body.clearActionIds.map(String) : [];

  if (!ticker) return bad(400, "종목을 고르세요.");
  if (side !== "매수" && side !== "매도") return bad(400, "매수 또는 매도만 가능합니다.");
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) return bad(400, "수량은 1 이상의 정수여야 합니다.");
  if (!Number.isFinite(price) || price <= 0) return bad(400, "체결가가 올바르지 않습니다.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad(400, "체결일 형식이 올바르지 않습니다 (YYYY-MM-DD).");
  if (note.length < 10) return bad(400, "체결 근거를 10자 이상 적어주세요. 원장은 나중에 우리가 읽을 기록입니다.");

  try {
    // ── 1. 지금의 main을 고정한다. 이 sha가 낙관적 잠금의 기준이 된다
    const ref = await gh(`/repos/${REPO}/git/ref/heads/${BRANCH}`, token);
    const baseCommitSha: string = ref.object.sha;
    const baseCommit = await gh(`/repos/${REPO}/git/commits/${baseCommitSha}`, token);
    const baseTreeSha: string = baseCommit.tree.sha;

    const [tradesRaw, holdingsRaw, actionsRaw, divRaw] = await Promise.all([
      readFile(token, FILES.trades, baseCommitSha),
      readFile(token, FILES.holdings, baseCommitSha),
      readFile(token, FILES.actions, baseCommitSha),
      readFile(token, FILES.dividends, baseCommitSha).catch(() => '{"items":[]}'),
    ]);

    const ledger = JSON.parse(tradesRaw) as LedgerFile;
    const holdings = JSON.parse(holdingsRaw) as Holdings;
    const actions = JSON.parse(actionsRaw) as { items: { id: string }[]; [k: string]: unknown };
    const dividendUsd = (JSON.parse(divRaw) as { items: { usd: number }[] }).items
      .reduce((s, i) => s + i.usd, 0);

    const pos = holdings.positions.find((p) => p.ticker === ticker);
    if (!pos) return bad(400, `${ticker}는 holdings.json에 없는 종목입니다. 먼저 종목을 등록하세요.`);

    // ── 2. 통화 → 체결 시점 환율. 원가는 이 환율로 굳고 다시는 환산하지 않는다
    let krwPerUsd: number;
    try {
      const q = await fetch(new URL("/api/quotes?symbols=KRW=X", req.url), { cache: "no-store" });
      krwPerUsd = (await q.json())?.quotes?.["KRW=X"]?.price;
    } catch { krwPerUsd = NaN; }
    if (!Number.isFinite(krwPerUsd) || krwPerUsd <= 0) return bad(502, "원/달러 환율을 가져오지 못했습니다. 잠시 후 다시 시도하세요.");

    let fxToUsd: number;
    if (pos.currency === "USD") fxToUsd = 1;
    else if (pos.currency === "KRW") fxToUsd = 1 / krwPerUsd;
    else return bad(400, `${pos.currency} 종목은 아직 보드에서 기록할 수 없습니다 (환율 환산 미지원). 원장에 직접 적어주세요.`);

    const usd = Math.round(qty * price * fxToUsd * 100) / 100;

    // ── 3. 기록 전 상태로 한 번 리플레이해서 검증한다
    const before = replayLedger(ledger);
    const held = before.book.get(ticker)?.qty ?? 0;
    if (side === "매도" && qty > held) {
      return bad(400, `보유 수량(${held.toLocaleString()}주)보다 많이 팔 수 없습니다.`);
    }
    const cashBefore =
      ledger.aumUsd - before.openingCostUsd - before.buysUsd + before.sellsUsd + dividendUsd;
    if (side === "매수" && usd > cashBefore) {
      return bad(400, `가용 현금 $${Math.round(cashBefore).toLocaleString()}보다 큰 금액($${Math.round(usd).toLocaleString()})은 매수할 수 없습니다.`);
    }

    // ── 4. 원장에 추가하고 다시 리플레이 → holdings를 여기서 파생시킨다.
    //      사람이 holdings를 손으로 고치지 않게 하는 게 이 엔드포인트의 핵심이다.
    const trade: LedgerTrade = {
      date, ticker, side, qty, price,
      currency: pos.currency as LedgerTrade["currency"],
      fxToUsd, krwPerUsd, usd,
      note,
    };
    ledger.trades.push(trade);

    const after = replayLedger(ledger);
    const b = after.book.get(ticker);
    const newQty = b?.qty ?? 0;
    pos.qty = newQty;
    // 평단은 현지통화 기준. 원화는 소수점이 없다.
    pos.avgPrice = newQty > 0
      ? (pos.currency === "KRW" ? Math.round(b!.avg) : Math.round(b!.avg * 10000) / 10000)
      : pos.avgPrice;
    pos.status = deriveStatus(newQty, b?.usdCost ?? 0, pos.targetUsd);

    // ── 5. 완료된 "오늘 할 일" 항목 정리 (규칙: 집행 끝나면 지운다)
    const before_n = actions.items.length;
    if (clear.length) actions.items = actions.items.filter((i) => !clear.includes(i.id));
    const cleared = before_n - actions.items.length;

    // ── 6. 두 파일(+actions)을 한 커밋에 담는다. 나눠 커밋하면 중간 상태가 배포될 수 있다
    const changed: { path: string; content: string }[] = [
      { path: FILES.trades, content: ser(ledger) },
      { path: FILES.holdings, content: ser(holdings) },
    ];
    if (cleared > 0) changed.push({ path: FILES.actions, content: ser(actions) });

    const blobs = await Promise.all(
      changed.map((f) =>
        gh(`/repos/${REPO}/git/blobs`, token, {
          method: "POST",
          body: JSON.stringify({ content: f.content, encoding: "utf-8" }),
        })
      )
    );
    const tree = await gh(`/repos/${REPO}/git/trees`, token, {
      method: "POST",
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: changed.map((f, i) => ({ path: f.path, mode: "100644", type: "blob", sha: blobs[i].sha })),
      }),
    });

    const realizedNote = (() => {
      if (side !== "매도") return "";
      const lot = after.realized[after.realized.length - 1];
      if (!lot) return "";
      const sign = lot.gainUsd >= 0 ? "+" : "−";
      return `\n실현손익 ${sign}$${Math.abs(lot.gainUsd).toFixed(2)} (${(lot.pct * 100).toFixed(2)}%)`;
    })();

    const message =
      `${date} ${ticker} ${side} ${qty.toLocaleString()}주 @ ${price.toLocaleString()}\n\n` +
      `보드에서 기록. $${usd.toLocaleString()} · 환율 ${krwPerUsd.toFixed(2)}원/$${realizedNote}\n` +
      `${note}\n` +
      (cleared ? `\n오늘 할 일 ${cleared}건 정리.\n` : "");

    const commit = await gh(`/repos/${REPO}/git/commits`, token, {
      method: "POST",
      body: JSON.stringify({ message, tree: tree.sha, parents: [baseCommitSha] }),
    });

    // force를 쓰지 않는다 — 읽은 뒤 누가 push했으면 fast-forward가 아니라서 거부된다.
    // 그게 우리의 잠금이다. 덮어쓰면 남의 매매 기록이 사라진다.
    try {
      await gh(`/repos/${REPO}/git/refs/heads/${BRANCH}`, token, {
        method: "PATCH",
        body: JSON.stringify({ sha: commit.sha, force: false }),
      });
    } catch {
      return bad(409, "기록하는 사이에 저장소가 변경됐습니다. 화면을 새로고침하고 다시 시도해 주세요.");
    }

    return NextResponse.json({
      ok: true,
      commit: commit.sha.slice(0, 7),
      trade: { date, ticker, side, qty, price, usd, krwPerUsd },
      position: { qty: pos.qty, avgPrice: pos.avgPrice, status: pos.status },
      cashAfter: Math.round(
        ledger.aumUsd - after.openingCostUsd - after.buysUsd + after.sellsUsd + dividendUsd
      ),
      clearedActions: cleared,
    });
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 401 || status === 403) {
      return bad(502, "저장소 접근 권한이 없습니다. GitHub 토큰이 만료됐거나 권한이 모자랍니다 — 관리자에게 알려주세요.");
    }
    if (status === 404) {
      return bad(502, "저장소나 파일을 찾지 못했습니다. 관리자에게 알려주세요.");
    }
    console.error("trade route", e);
    return bad(500, "기록에 실패했습니다. 잠시 후 다시 시도하고, 계속되면 관리자에게 알려주세요.");
  }
}
