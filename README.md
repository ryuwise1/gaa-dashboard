# 글리프자운팀 포트폴리오 대시보드

팀 전체가 보는 실시간(준실시간) 포트폴리오 웹 대시보드. Next.js + Vercel.

## 구조

- `data/holdings.json` — **현재 보유 상태의 원본** (수량·평단가·상태·목표 플랜). 매매가 있으면 이 파일을 고치고 다시 배포하면 됨.
- `data/trades.json` — **체결 원장.** 매매가 생기면 여기에 한 줄 추가한다. 화면의 매매 내역·현금·집행률·실현손익이 전부 이 파일에서 계산된다.
  - `openingPositions` — 원장 시작(2026-07-30) 직전 보유분. 실현손익 계산의 기준점이라 지우면 안 됨.
  - `meetings` — 정기회의 회차·날짜. 각 체결의 `meeting` 필드가 여기를 가리킨다.
  - 각 체결: `fxToUsd`(현지통화 1단위당 USD) + `usd`(체결 USD 금액). 비USD 종목은 이 값이 있어야 현금이 정확히 계산된다.
- `lib/trades.ts` — 원장을 되감아 종목별 장부·실현손익·현금을 만든다. 평단은 이동평균법.
- `lib/macro.ts` — 상단 매크로 스트립에 띄우는 지표 목록 (VIX·DXY·10Y·WTI·Brent·Gold·S&P 500)
- `app/api/quotes/route.ts` — 시세 프록시 (30초 서버 캐시). 국내는 네이버 실시간, 해외·환율·매크로는 야후. holdings + 환율 + 매크로 심볼만 허용하는 화이트리스트.
- `components/Dashboard.tsx` — 화면 전체 (60초 자동 갱신)
- `components/TradeLog.tsx` — 매매 내역 (체결일 그룹 · 회차 배지 · 매수/매도·종목 필터 · 확정손익)
- `components/WeeklyReport.tsx` — 주간 운용보고 초안 생성 + 카톡용 복사
- `middleware.ts` — `GAA_DASH_PASSWORD` 환경변수가 있으면 비밀번호 잠금

## 화면에서 볼 수 있는 것

| 위치 | 내용 |
|---|---|
| 상단 스트립 | 보유 종목 시세 + 매크로 지표(VIX·DXY·10Y·WTI·Brent·Gold·S&P) |
| 히어로 카드 | 평가금액·평가손익·오늘·환율 + **AUM 집행률 바 · 현금 · 총자산 · 실현손익 · 원금 대비** |
| 보유 현황 표 | 행을 클릭하면 **그 종목의 체결 이력**이 펼쳐짐 (건수 배지로 표시) |
| 매매 내역 | 체결일별 그룹, 몇 차 회의에서 결정했는지 배지, 매수/매도·종목 필터, 행 클릭 시 매매 근거 |
| 주간 운용보고 초안 | 현재 시세로 포트폴리오 현황·종목별 수익률·섹터 비중을 채운 카톡용 텍스트 생성·복사 |

> 섹터 비중은 **AUM 기준**으로 표기한다. 목표 비중이 AUM 기준이라 주식 평가금액 기준으로 쓰면 현금이 빠져 모든 섹터가 부풀어 보인다.

## 로컬 실행

```bash
npm install
npm run dev
```

→ http://localhost:3000

## Vercel 배포

```bash
npx vercel          # 첫 배포 (로그인 필요)
npx vercel --prod   # 프로덕션 배포
```

배포 후 Vercel 프로젝트 → Settings → Environment Variables에
`GAA_DASH_PASSWORD` = 팀 공유 비밀번호 를 추가하고 재배포하면 잠금이 걸린다.
(설정하지 않으면 링크를 아는 누구나 볼 수 있음 — 금액이 그대로 보이니 권장)

## 데이터 갱신 흐름

1. 매매 발생 → Claude에서 `/포트업데이트 QCOM 10주 150.55 매수`
2. 세 곳을 같이 고친다 — 노션 DB(팀 페이지) · `data/holdings.json` · **`data/trades.json`**
3. `npx vercel deploy --prod --yes` 재배포 (또는 GitHub 연결 시 push만)

`trades.json`에 한 줄을 빠뜨리면 화면의 현금·집행률·실현손익이 전부 어긋난다. 반대로 `holdings.json`의 수량·평단은 원장을 되감으면 나오는 값이라, 둘이 안 맞으면 원장이 맞다고 보고 `holdings.json`을 고치면 된다.

시세는 배포와 무관하게 Yahoo에서 실시간으로 가져온다 (거래소별 최대 15~20분 지연).
