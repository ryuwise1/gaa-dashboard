# GLIF 자산운용팀 포트폴리오 대시보드

성균관대학교 금융투자학회 GLIF 26-2 자산운용팀의 모의 포트폴리오(가상 AUM $500,000)를 실시간 시세로 보여 주는 웹 대시보드입니다. 실제 자금은 들어가지 않습니다.

- 사이트: https://gaa-dashboard-eight.vercel.app
- 화면별 기능 설명: 사이트의 "안내" 탭 (https://gaa-dashboard-eight.vercel.app/?tab=guide)

## 기술 구성

- Next.js 16 (App Router) · React 19 · TypeScript
- 데이터베이스 없음 — 보유 종목·체결·회의록은 `data/` 폴더의 JSON 파일이 원본
- 시세: 국내 주식은 네이버 금융, 해외 주식·환율·지수는 Yahoo Finance (둘 다 비공식 엔드포인트라 예고 없이 막힐 수 있음)
- 배포: Vercel — `main` 브랜치에 push하면 자동 배포

## 로컬 실행

```bash
npm install
npm run dev
```

http://localhost:3100 에서 열립니다. API 키 없이도 조회 화면은 모두 동작합니다.

## 폴더 구조

| 경로 | 내용 |
|---|---|
| `components/` | 화면. `Dashboard.tsx`가 요약 카드와 탭을 묶고, 탭마다 컴포넌트가 하나씩 있음 |
| `app/api/quotes` | 실시간 시세 (네이버 + Yahoo) |
| `app/api/history`, `bench` | 총자산 추이(체결 원장 × 일봉 종가로 역산), 운용 시작 이후 지수 수익률 |
| `app/api/spark`, `signals` | 종목 기간 차트(MA20·MA60·RSI), 규칙 기반 시그널 |
| `app/api/calendar`, `dividends` | 경제지표·어닝 일정, 보유 종목 배당 |
| `app/api/trade` | 보드에서 매매를 기록하면 GitHub에 커밋 (환경변수 필요) |
| `lib/ledger-core.ts` | 체결 원장 리플레이 — 보유 수량·이동평균 평단·실현손익·현금 |
| `data/trades.json` | 체결 원장. 화면의 모든 금액 계산의 원본 |
| `data/holdings.json` | 종목·섹터·목표 비중·편입 근거·기업 설명 |
| `data/meeting-notes.json`, `actions.json` | 회의록, 팀 할 일 |
| `data/macro-*.json`, `kr-events.json`, `dividend-ledger.json` | 캘린더 일정, 배당 수령 기록 |
| `research/` | 관심 종목 리서치 노트 |
| `tools/` | 원장 정합성 검사기, 경제지표 스크랩, 보고용 PNG 카드 스크립트 |

## 데이터 흐름

1. 체결이 생기면 `data/trades.json`에 한 건씩 추가합니다. 팀 모드의 매매 기록 폼을 쓰면 자동으로 커밋됩니다.
2. 원장을 날짜순으로 리플레이해 보유 수량·평단·현금·실현손익을 계산합니다.
3. 평가액은 실시간 시세 × 보유 수량입니다. 국내 주식 원가는 체결 시점 환율로 고정해 환차손익을 따로 봅니다.

원장을 직접 고쳤다면 `node tools/check-ledger.mjs`로 `holdings.json`의 수량·평단이 원장과 일치하는지 확인합니다.

## 환경변수 (모두 선택)

| 변수 | 용도 |
|---|---|
| `GAA_DASH_PASSWORD` | 설정하면 사이트 전체에 HTTP 기본 인증을 겁니다 |
| `GAA_TRADE_SECRET`, `GAA_GH_TOKEN` | 보드에서 매매를 기록하는 기능. 없으면 이 기능만 꺼집니다 |

## 팀 모드

주소 뒤에 `?team`을 붙이면 비밀번호를 묻고, 통과하면 오늘의 분석·회의록 탭, 오늘 할 일, 매매 기록 폼 같은 팀 전용 기능이 열립니다. 비밀번호 확인이 브라우저에서 이뤄지므로 보안 장치가 아니라 화면을 나누는 용도입니다.

## 참고

- `CLAUDE.md` — 작업 규칙과 인수인계 메모. Claude Code로 이 저장소를 열면 자동으로 읽습니다.
- 학회 교육용 모의 운용 기록이며 투자 권유가 아닙니다.
