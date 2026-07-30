import { NextRequest, NextResponse } from "next/server";
import { HOLDINGS, FX_SYMBOLS, type Quote } from "@/lib/portfolio";

export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const ALLOWED = new Set<string>([
  ...HOLDINGS.positions.map((p) => p.yahoo),
  ...FX_SYMBOLS,
]);

const TTL_MS = 30_000;
const cache = new Map<string, { t: number; q: Quote }>();

async function fetchQuote(symbol: string): Promise<Quote | null> {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.t < TTL_MS) return hit.q;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) return hit?.q ?? null; // 실패 시 만료된 캐시라도 반환

  const json = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) return hit?.q ?? null;

  const q: Quote = {
    symbol,
    price: meta.regularMarketPrice,
    prevClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
    currency: meta.currency ?? null,
    time: meta.regularMarketTime ?? null,
  };
  cache.set(symbol, { t: Date.now(), q });
  return q;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = raw.split(",").map((s) => s.trim()).filter((s) => ALLOWED.has(s));
  if (symbols.length === 0) {
    return NextResponse.json({ error: "no valid symbols" }, { status: 400 });
  }

  const results = await Promise.allSettled(symbols.map(fetchQuote));
  const quotes: Record<string, Quote> = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) quotes[symbols[i]] = r.value;
  });

  return NextResponse.json(
    { quotes, fetchedAt: Date.now() },
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=120" } }
  );
}
