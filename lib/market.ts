export type MarketCode = "KR" | "US";

const SPEC = {
  KR: { tz: "Asia/Seoul", open: 9 * 60, close: 15 * 60 + 30, label: "국내장" },
  US: { tz: "America/New_York", open: 9 * 60 + 30, close: 16 * 60, label: "미국장" },
} as const;

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** 특정 타임존 기준의 요일(0=일)과 자정 이후 분(minute) */
function zoneParts(d: Date, timeZone: string): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // 일부 런타임이 자정을 24로 반환
  return { weekday: WEEKDAY[get("weekday")] ?? 0, minutes: hour * 60 + parseInt(get("minute"), 10) };
}

export interface MarketStatus {
  code: MarketCode;
  label: string;
  open: boolean;
  /** 다음 개장(또는 오늘 마감)까지 안내 문구 */
  hint: string;
}

function fmtKstTime(minutesInTz: number, tz: string, now: Date): string {
  // 해당 시장의 개장 시각을 KST로 환산해 보여주기 위한 간단한 오프셋 계산
  const kst = zoneParts(now, "Asia/Seoul").minutes;
  const local = zoneParts(now, tz).minutes;
  let diff = kst - local;
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  const t = (((minutesInTz + diff) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function marketStatus(code: MarketCode, now: Date): MarketStatus {
  const s = SPEC[code];
  const { weekday, minutes } = zoneParts(now, s.tz);
  const isWeekday = weekday >= 1 && weekday <= 5;
  const open = isWeekday && minutes >= s.open && minutes < s.close;

  let hint: string;
  if (open) {
    hint = `${fmtKstTime(s.close, s.tz, now)} 마감`;
  } else if (!isWeekday) {
    hint = "주말 휴장";
  } else {
    hint = `${fmtKstTime(s.open, s.tz, now)} 개장`;
  }
  return { code, label: s.label, open, hint };
}

/** 보유 종목의 통화로 소속 시장 판별 (KRW만 국내장, 나머지는 해외) */
export function marketOfCurrency(currency: string): MarketCode {
  return currency === "KRW" ? "KR" : "US";
}
