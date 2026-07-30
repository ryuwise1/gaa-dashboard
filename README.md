# 글리프자운팀 포트폴리오 대시보드

팀 전체가 보는 실시간(준실시간) 포트폴리오 웹 대시보드. Next.js + Vercel.

## 구조

- `data/holdings.json` — **보유 데이터의 원본** (수량·평단가·목표 플랜). 매매가 있으면 이 파일을 고치고 다시 배포하면 됨. `/포트업데이트` 커맨드가 노션과 함께 이 파일도 갱신한다.
- `app/api/quotes/route.ts` — Yahoo Finance 시세 프록시 (30초 서버 캐시, holdings에 있는 심볼만 허용)
- `components/Dashboard.tsx` — 화면 전체 (60초 자동 갱신)
- `middleware.ts` — `GAA_DASH_PASSWORD` 환경변수가 있으면 비밀번호 잠금

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
2. 노션 DB(팀 페이지) + `data/holdings.json` 동시 갱신
3. `npx vercel --prod` 재배포 (또는 GitHub 연결 시 push만)

시세는 배포와 무관하게 Yahoo에서 실시간으로 가져온다 (거래소별 최대 15~20분 지연).
