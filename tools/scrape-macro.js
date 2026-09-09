/* Nasdaq economicevents 스크랩 — 2026-07-01 ~ 2026-09-08 평일 전체.
   koMacro 사전에 있는 지표 + 기준금리 결정만 남긴다.
   출력: data/macro-history.json { "YYYY-MM-DD": [MacroEvent...] } */
const fs = require("fs");
const path = require("path");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// lib/macro-dict.ts의 DICT를 정규식으로 재사용하기 어려우니 ts 파일을 파싱한다
const dictSrc = fs.readFileSync(path.join(__dirname, "..", "lib", "macro-dict.ts"), "utf8");
const DICT = [...dictSrc.matchAll(/\{ match: "([^"]+)", ko: "([^"]+)", desc: "([^"]*)" \}/g)]
  .map((m) => ({ match: m[1], ko: m[2], desc: m[3] }));
function koMacro(title) {
  for (const e of DICT) if (title.includes(e.match)) return { ko: e.ko, desc: e.desc };
  return null;
}

const COUNTRY = {
  "United States": "미국",
  "Euro Zone": "유로존", "European Union": "유로존", "Germany": "유로존",
  "United Kingdom": "영국", "Japan": "일본", "China": "중국", "South Korea": "한국",
};
const RATE_KO = {
  "미국": { ko: "FOMC 기준금리 결정", desc: "TLT·IEF·환율 전부에 직결" },
  "유로존": { ko: "ECB 기준금리", desc: "유로존 통화정책 — EUAD 등 유럽 자산에 영향" },
  "영국": { ko: "영란은행 기준금리", desc: "영국 통화정책" },
  "일본": { ko: "일본은행 기준금리", desc: "엔 캐리 흐름 — 글로벌 유동성에 영향" },
  "한국": { ko: "한국은행 기준금리 (금통위)", desc: "국내주식·원화에 직결" },
  "중국": { ko: "중국 LPR 결정", desc: "중국 유동성 — 코스피·원자재에 영향" },
};

// ET 오프셋: 2026년 DST는 3/8~11/1 — 7~10월 -04:00, 11월 이후 -05:00
const etOffset = (date) => (date < "2026-11-02" ? "-04:00" : "-05:00");

// 변형·지역·파생 지표는 소음이라 통째로 거른다
const BLOCK = /GDPNow|Cushing|Baden|Bavaria|Brandenburg|Hesse|North Rhine|Saxony|Cleveland CPI|Index|n\.s\.a|\bs\.a\b|YTD|ex Tobacco|CPIH|Non-EU|forecast \dm ahead|GDP (Sales|Price|Capital|External|Private)|GDP Annualized|BRC |NIESR|U6 |ex\. Food|Ex Gas|Monitor|Tracker|1-Year|3M\/3M|Large Scale|BoJ Core/i;

async function fetchDay(date) {
  const res = await fetch(`https://api.nasdaq.com/api/calendar/economicevents?date=${date}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json?.data?.rows ?? [];
}

function verdictOf(actual, ref) {
  const num = (s) => {
    const m = (s ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    let v = parseFloat(m[0]);
    if (/\d\s*[bB]\b/.test(s)) v *= 1e9;
    else if (/\d\s*[mM]\b/.test(s)) v *= 1e6;
    else if (/\d\s*[kK]\b/.test(s)) v *= 1e3;
    return v;
  };
  const a = num(actual), r = num(ref);
  if (a == null || r == null) return null;
  return a > r ? "상회" : a < r ? "하회" : "부합";
}

(async () => {
  const out = {};
  // 낫닥 date 파라미터는 실제 ET 발표일 +1일 — 쿼리일-1이 진짜 발표일이다.
  // 금요일 발표(고용보고서 등)가 토요일 쿼리에 실리므로 주말 포함 매일 쿼리한다.
  // 사용법: node tools/scrape-macro.js [시작 발표일 YYYY-MM-DD] [종료 발표일] — 기본 2026-07-01 ~ 2026-09-08.
  // 결과는 data/macro-history.json에 병합한다(같은 날짜는 새 값으로 덮어씀).
  const [aStart, aEnd] = [process.argv[2] ?? "2026-07-01", process.argv[3] ?? "2026-09-08"];
  const start = new Date(Date.parse(aStart + "T00:00:00Z") + 86400000); // 쿼리일 = 발표일 + 1
  const end = new Date(Date.parse(aEnd + "T00:00:00Z") + 86400000);
  let n = 0;
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
    const queryDate = d.toISOString().slice(0, 10);
    const date = new Date(d.getTime() - 86400000).toISOString().slice(0, 10); // 실제 ET 발표일
    try {
      const rows = await fetchDay(queryDate);
      const evs = [];
      for (const r of rows) {
        const country = COUNTRY[r.country];
        if (!country) continue;
        if (BLOCK.test(r.eventName)) continue;
        const isRate = /interest rate decision/i.test(r.eventName);
        const k = isRate ? RATE_KO[country] : koMacro(r.eventName);
        if (!k) continue;
        const time = `${date}T${(r.gmt && /^\d{2}:\d{2}$/.test(r.gmt) ? r.gmt : "08:30")}:00${etOffset(date)}`;
        const ev = {
          time, country,
          title: r.eventName,
          ko: k.ko, desc: k.desc || null,
          impact: "High",
          forecast: (r.consensus ?? "").trim(),
          previous: (r.previous ?? "").trim(),
        };
        const actual = (r.actual ?? "").trim();
        if (actual) {
          ev.actual = actual;
          const v = verdictOf(actual, ev.forecast || ev.previous);
          if (v) ev.verdict = v;
        }
        evs.push(ev);
      }
      // 같은 날 같은 지표의 m/m·y/y 변형은 하나만 — 예상치 있는 행 우선, 그다음 절대값 큰 행(연율)
      const num = (s) => { const m = (s ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? Math.abs(parseFloat(m[0])) : 0; };
      const byKo = new Map();
      for (const ev of evs) {
        const key = ev.country + "|" + ev.ko;
        const cur = byKo.get(key);
        if (!cur) { byKo.set(key, ev); continue; }
        const evScore = (ev.forecast ? 1000 : 0) + num(ev.actual ?? ev.previous);
        const curScore = (cur.forecast ? 1000 : 0) + num(cur.actual ?? cur.previous);
        if (evScore > curScore) byKo.set(key, ev);
      }
      const deduped = [...byKo.values()].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
      if (deduped.length) out[date] = deduped;
      n++;
      process.stdout.write(`${date}: ${evs.length}건 (raw ${rows.length})\n`);
    } catch (e) {
      process.stdout.write(`${date}: FAIL ${e}\n`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  const file = path.join(__dirname, "..", "data", "macro-history.json");
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const merged = Object.fromEntries(Object.entries({ ...existing, ...out }).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(file, JSON.stringify(merged, null, 1), "utf8");
  console.log(`done: ${n} days fetched, ${Object.keys(out).length} days with events -> ${file}`);
})();
