---
type: stock
model: company-claim-v1
converted: 2026-08-26
log: log/MRVL_log.md
archive: log/MRVL_body_archive_2026-08-26.md
---
# MRVL — Marvell Technology

> **역할**: MRVL에 대해 현재 무엇을 믿는지 보여주는 상시 리서치 상태 페이지 — 실적·어닝콜을 바닥으로 P·Q·Capture·Margin·Duration 가정을 움직이는 Claim과 반증을 갱신하는 '말로 된 기업 모델' (구조·판정 절차: `memory/company-wiki-guide.md`)
> Raw = research_db(doc#) / 연대기 = `log/MRVL_log.md` / 포지션 = §12 Decision layer 포인터

---

## 1. Current View

MRVL의 핵심 논지는 **AI 서버 원가가 GPU → 메모리·연결로 이동하는 구조에서, 그 연결 통로(커스텀 XPU·옵티컬 DSP·스위칭·CXL)를 풀스택으로 파는 유일 상장사**라는 것이다.

- **Q**: FY27 ~$115억(+40%)·FY28 ~$165억 가이던스는 **이미 수주한 디자인만 반영** — 신규 수주는 upside. 커스텀은 FY28에 기존 확장 1/3 + XPU attach 1/3 + 신규 Tier 1 1/3로 각 축 2배+.
- **P·Capture**: 구글 워런트(최대 5,896만주, 240트랜치×$5억 = 잠재 구매약정 최대 약 $1,200억 함의)가 TPU 인접칩(추론 오프로드·NIC·CXL·스토리지) 어태치 지위를 계약 구조로 고정. 모든 미국 하이퍼스케일러와 커스텀 engagement 보유.
- **Margin**: Adj GM 58.9%·OPM 35% — 커스텀 믹스 확대에도 방어 중. 공급 선급금 $10억으로 캐파 확보.
- **Duration**: FY29 커스텀 $100억+(TAM $550억×20%) 재확인. Scale-up switching·CPO는 FY28 가이던스에 사실상 미반영된 greenfield — 다음 사이클의 옵션.

**가장 중요한 반대 축**: ① AVGO 대비 ASIC 규모 열세 ② AWS/MS 고객 집중 ③ CPO 양산 진입이 경쟁사 대비 한 세대 늦음(2028) ④ 구글 워런트의 드랍(대체) 가능성.

현재 결론: **관심 유지 — 수주 기반 가이던스와 구글 계약 구조가 가시성을 높였고, CXL·scale-up이 미반영 옵션으로 남아 있는 구도.**

---

## 2. Latest Actuals

> ⚓ 어닝콜 원문 기준 (doc#1103 실적 + doc#1104 Q&A 원문 — FY2027 1Q, 2026-05-28). Phase 1 수동 표. ⚠️ F2Q27 실적(8월 말 발표 예정)은 미반영 — 발표 시 갱신.

| Metric | FY27 1Q (reported) | Guidance |
|---|---|---|
| Revenue | **$24.18억** (+28% YoY, 사상 최대, 예상 $24.0억 상회) | 2Q $27억±5% (+35% YoY, 컨센 $26억 상회) |
| 데이터센터 | $18.3억 (+27% YoY, +11% QoQ, **전체 76%**) | FY27 DC +50% / FY28 DC +55% |
| 통신·기타 | $5.85억 (+29% YoY) | — |
| Adj. EPS / GM / OPM | $0.80 (+29%) / 58.9% / 35% | 2Q EPS $0.88~0.98, GM 58.25~59.25% |
| 영업현금흐름 | $6.39억 (사상 최고) | — |
| 연간 매출 | — | **FY27 ~$115억(+40%) · FY28 ~$165억(+45%) · FY27 3Q 분기 $30억 도달(1분기 앞당김)** |
| 커스텀 | — | FY28 2배+ 성장 · **FY29 $100억+** (TAM ~$550억×20%) |
| 인터커넥트 | 800G 강세·1.6T 빠른 램프 | FY27 **+70%↑** (기존 +50%에서 상향) |
| 제품별 run-rate | TIA·driver 연환산 $10억 초과 임박 · Scale-out switch FY27 $6억↑/FY28 $10억↑ · DCI FY28 $10억 가시권 · AEC·retimer FY27 2배↑ | Scale-up switching은 **FY28 $165억에 사실상 미반영** |
| M&A/파트너십 | Celestial AI(포토닉 패브릭, Tier1 XPU scale-up 채택)·XConn(CXL)·Polariton 인수 완료 · NVIDIA 확장 파트너십(광학·NVLink Fusion·AI-RAN) | — |
| 재무 | 총부채 $49.6억 · Net debt/EBITDA 0.32x · 자사주 $2억·배당 $5,400만 | FY27 공급 선급금 ~$10억 |

**Q&A 구조 발언 (Claim 레이어 반영)**: 전망은 수주 디자인만 기반(Q3) / 커스텀 성장 3×1/3(Q10) / CXL은 x86→AI 이동·XPU attach만 $10억+(Q5) / Scale-up은 greenfield·전 표준 동시 베팅(Q8·Q9) / 공급제약은 2020~21년부터 상시(Q6).

### 🧬 BM 구조 복원 (Prepared Remarks + Q&A 기준 — 요약 ❌)

> ⚓ `doc#2541`(fool.com 어닝콜 전사, 2026-05-28 콜 / 2026-08-27 적재). doc#1103·1104는 실적 정리, 본 절은 **회사가 커스텀 사업 구조를 설명한 프레임**의 복원이다.
> ⚠️ **FY27 2분기(2026-09 초 발표 예정) 실적은 아직 반영 대상이 아니다** — 본 절의 기준 분기는 FY27Q1이다.

**Murphy가 제시한 "커스텀 성장 3분의 1 × 3" 프레임 — 이번 콜에서 회사가 성장을 분해한 공식 구조**

| 동인 | 회사가 규정한 내용 | 기여 비중 | 움직이는 Driver |
|---|---|---|---|
| ① **기존 플래그십 XPU 프로그램 성장** | 다세대 진행 중 | **약 1/3** | Q |
| ② **XPU-attach 프로그램 10건 초과 램프** | **CXL · NIC · 메모리 익스팬더**. 목표 "향후 몇 년 내 $10억 초과" | **약 1/3** | Q / Capture |
| ③ **신규 tier-1 XPU 양산** | FY28 양산, 요구사양 확정(locked) | **약 1/3** | Q |

> 🔑 Murphy는 Q1과 Q10에서 **같은 3분의 1 구조를 두 번 반복**했고, Q10에서 **"FY28 커스텀 매출 2배 초과에서도 대략 같은 비율이 유지된다"**고 확인했다. 이는 **성장이 단일 고객·단일 프로그램에 걸려 있지 않다**는 회사의 핵심 방어 논리다.

**경쟁 우위로 회사가 지목한 기술 축** (Q2·Q3·Q8)

| 축 | 회사 발언 |
|---|---|
| **SRAM 설계·IP** | **"업계 최고 수준"** — Avera 인수 및 그 이전 IBM·GlobalFoundries 계보. **"XPU attach에서 디자인을 따내는 이유 중 하나"** |
| **고속 I/O · SerDes · die-to-die** | Q3에서 경쟁력의 핵심으로 직접 지목 |
| **실리콘포토닉스** | **"4세대에 걸친 150억 시간의 디바이스 데이터"** — 신생 진입자와 구분되는 실적 |
| **첨단 패키징 · 제조 전문성** | SRAM을 포함한 "더 큰 전략"의 일부 |

경영진이 설명한 인과사슬:

```
하이퍼스케일러가 XPU를 직접 설계한다 — 그러나 혼자서는 못 만든다
   → 필요한 것: 고속 I/O·SerDes·die-to-die·SRAM·첨단 패키징
   → MRVL은 XPU 자체(커스텀)와 XPU 주변(attach)을 동시에 판다
      → 그래서 "미국 하이퍼스케일러 전반에 커스텀 관여"가 있고
        형태가 XPU / XPU-attach / attach-only로 다양하다 (Q3)
   → 성장은 3축으로 분산: 기존 확장 · attach 10건+ · 신규 tier-1 (각 1/3)
   → 네트워크 쪽에서 두 번째 축이 열린다
      스케일아웃(확립된 시장, MRVL은 이미 $10억 궤도)
      → 스케일업(시장 점유율 미확립) = "더 큰 기회"이고 "전부 상방"
        UALink · eSUN · NVLink Fusion 모두 지원 (표준 중립 전략)
      → 여기에 scale-across(DCI)가 세 번째 층으로 추가 — TAM 10배 이상 확장
   → 광학: Celestial AI·Polariton 인수로 "XPU에서 스위치까지 엔드투엔드"
      Celestial AI가 tier-1 하이퍼스케일러 디자인에 채택됨
   → 공급: 소수 핵심 공급사 + 5년 예측 + FY27 약 $10억 선급금
      Koopmans: "말한 것을 실제로 해내는 것"이 할당을 확보한다
   → 재무: FY27 매출 약 $11.5B(+40%) → FY28 $16.5B(+45%)
      OpEx 증가율 mid-to-high teens ≪ 매출 +45% → 목표 OPM 38~40% 밴드의 상단
```

**BM 상 이번 콜의 진짜 변화 4가지**

1. 🔑 **가이던스에 아직 반영되지 않은 상방이 명시적으로 2개 있다.** ① **스케일업 스위칭 — "전부 상방(all upside)"이며 현 가이던스에 반영돼 있지 않다**(Q9). ② **최근 신규 수주 — "목표 달성에 필요한 것이 아니라 보험(insurance policy)"**(Q3). → **FY28 $16.5B 가이던스는 확정된 디자인만으로 구성된 숫자**라는 뜻이다. 이는 이 종목 가이던스의 성격을 규정하는 문장이다.
2. **NVIDIA가 경쟁자가 아니라 3축 파트너로 정리됐다.** ① 옵틱스(DSP·TIA·드라이버 + 실리콘포토닉스) ② **NVLink Fusion 통합** ③ AI RAN(OCTEON + GPU). 🔑 **스케일업에서 UALink·eSUN·NVLink Fusion을 모두 지원**한다는 것은 **표준 전쟁에서 중립을 택했다**는 뜻 — 어느 표준이 이기든 콘텐츠를 판다.
3. **인터커넥트 성장률 가이던스가 한 분기에 50% → 70% 초과로 상향됐다.** Seymore(Q7)가 *"연초 30%, 그다음 50%, 지금 70% 초과인데 왜 내년엔 하이퍼스케일러 CapEx 성장률 근처로 둔화한다고 보나"*라고 물었고, Murphy는 **"이것이 오늘 시점의 우리 위치"**라며 상방 동인을 나열한 뒤 **"분명히 상방 편향이 있다"**로 답했다. → **회사 스스로 자기 가이던스를 보수적이라고 규정**했다.
4. **공급 확보 방식이 "관계 + 선급금"으로 구체화됐다.** COO Koopmans: 소수 핵심 공급사 · **5년 예측** · **FY27 약 $10억 선급금**. 🔗 **AVGO Tan의 "공급 확보는 돈만 던진다고 되는 게 아니다"**(doc#2536 Q5)와 **같은 논리**이며, 팹리스가 캐파 할당을 사는 방식이 업계 표준이 되고 있음을 보여준다.

### 🤝 고객·파트너 증거 (계약·채택 실측 — Q·Capture의 바닥)

> `doc#2541`. ⚠️ **MRVL은 고객 실명을 거의 밝히지 않는다** — 이번 콜 유일한 실명 파트너는 NVIDIA와 피인수 기업들이다. 있는 척 금지.

| 고객/파트너 | 내용 (규모·성격) | 움직이는 Driver |
|---|---|---|
| **NVIDIA** 🔑 | **3축 파트너십** — ① 옵틱스(DSP·TIA·드라이버 + 실리콘포토닉스 협력) ② **NVLink Fusion 통합**(커스텀 칩·네트워킹이 NVIDIA 인프라에 매끄럽게 연결) ③ **AI RAN**(OCTEON 기지국 + GPU, 5G·6G와 AI 동시 실행) | Capture / Q |
| **플래그십 XPU 고객(익명)** | 기존 프로그램, 다세대 진행 | Q |
| **신규 tier-1 XPU 고객(익명)** | **FY28 양산**, 요구사양 확정(locked). Murphy: "모든 마일스톤을 달성 중" | Q |
| **XPU-attach 고객(익명, tier-1)** | **10건 초과 활성** — CXL · NIC · 메모리 익스팬더 | Q |
| **미국 하이퍼스케일러 전반** | Murphy: **"미국 하이퍼스케일러 전반에 걸쳐 커스텀 관여"**, 형태는 XPU / attach / attach-only로 다양 | Capture |
| **DCI 고객** | **미국 5대 하이퍼스케일러 전부** — 플러거블 DCI 모듈 출하 | Q |
| **골든케이블 프로그램** | **tier-1 미국 하이퍼스케일러 3곳** 디자인윈 | Q |
| **Celestial AI**(인수) | 포토닉 패브릭·EAM 변조기·저전력 아날로그 SerDes. 🔑 **tier-1 하이퍼스케일러 디자인에 채택 확정**. Murphy: **"홈런"** | Capture |
| **Polariton**(인수) | 플라스모닉 실리콘포토닉스, **1THz 초과 변조기 대역폭**(전통 대비 10배), 로드맵 3.2T+ | Duration |
| **XConn**(인수) | CXL 스위칭 | Capture |
| **스케일업 스위칭 고객(익명)** | **복수 tier-1과 논의 중**, 건당 **수십억 달러 생애 매출**. ⚠️ **가이던스 미반영** | Q (상방 옵션) |
| **핵심 공급사(소수)** | **5년 예측 + FY27 약 $10억 선급금**으로 캐파 할당 확보 | Duration |

### 🎙️ 어닝콜 Q&A 원장 (FY27Q1 — 전 10문 무누락)

> 규칙: 질문 → 답변 핵심 → **움직인 Claim**. Claim을 안 움직인 문답도 적는다. 정본 `doc#2541`.

**Q1. Vivek Arya (BofA)** — *"커스텀 XPU가 FY29 $100억 목표인데 FY28이 $40억 남짓이면 YoY $50~60억 증가다. 대형 신규 고객을 언제부터 더 편하게 말하게 됐나? 독점을 기대하나?"*
→ **Murphy**: FY29 **$100억 초과** 목표 확인. 신규 프로그램은 **"그대로 궤도에 있고 모든 마일스톤을 달성하고 있다"**. 이 프로그램이 **"내년 커스텀 사업 성장의 여전히 약 3분의 1"**. 전 커스텀 프로그램에서 수요 신호가 넓어지고 있다.
→ `Q STRENGTHENED` — ⚠️ **독점 여부에는 답하지 않았다**(회피 1건). 고객 실명도 없음

**Q2. Harlan Sur (JPMorgan)** — *"SRAM 기반 IP 차별화를 활용하고 있나? SRAM 기반 XPU 오프로드 ASIC 디자인윈이 있나?"*
→ **Murphy**: 🔑 **"업계 최고 수준의 SRAM 설계 역량과 IP"** — 계보는 **Avera 인수 및 그 이전 IBM·GlobalFoundries** 작업. **"SRAM은 XPU attach에서 우리가 디자인을 따내는 이유 중 하나"**이며 첨단 패키징·고속 I/O·제조 전문성을 아우르는 **"더 큰 전략"**의 일부.
→ 🔑 `Capture` — **attach 수주의 기술적 근거가 SRAM으로 특정**됐다. 🔗 이는 AVGO Tan이 Q13에서 **"XPU에 SRAM을 넣고 CPU 코어를 임베드해 가격이 올라간다"**(doc#2536)고 말한 것과 **같은 기술 방향** — 두 회사가 동일한 콘텐츠 증가 경로를 보고 있다

**Q3. Timothy Arcuri (UBS)** — *"컴퓨트 TAM으로 이동한다는 관측이 있다. 전망에 포함돼 있나, 증분인가?"*
→ **Murphy**: **"미국 하이퍼스케일러 전반에 걸쳐 커스텀 관여"**가 있고 형태는 **XPU / XPU-attach / attach-only**로 다양. 🔑 현 가이던스는 **"이미 따내고 확정한 디자인"**을 포함하며, 최근 수주는 목표 달성에 필요한 것이 아니라 **"보험(insurance policy)"** 성격의 상방. 경쟁력은 **"고속 I/O, SerDes 성능, die-to-die"**.
→ 🔑 **§2-B 변화 1의 정본(전반)** — **가이던스가 확정 디자인만으로 구성**돼 있다는 규정

**Q4. Aaron Rakers (Wells Fargo, 대리 Michael)** — *"그 XPU 또는 XPU-attach가 어떤 종류의 가속기·칩인지 색깔을 줄 수 있나?"*
→ **Murphy**: **"현 시점에 추가로 밝힐 내용은 없다."** 다만 **"1년 전에 본 모든 프로그램이 1년 뒤에 보면 더 커져 있다."**
→ ⚠️ `NO CHANGE` — **명시적 공개 거부**(회피 2건). Claim을 움직이지 않았으나 **"프로그램이 매년 커진다"**는 정성 진술은 §8 기준선으로 기록

**Q5. Blayne Curtis (Jefferies)** — *"가속기와 나란히 가는 CXL 기회는 얼마나 실질적인가? 가속기당 콘텐츠로 생각할 방법은?"*
→ **Murphy**: CXL은 **"매우 실질적인 기회"**. 처음엔 x86 서버 동학이 이끌었으나 **"이제 AI 쪽으로 방향이 틀어졌다"**. 커스텀 XPU-attach 목표가 **"향후 몇 년 내 $10억 초과"**. 🔑 **메모리 아키텍처 우려가 "CXL 기반 설계의 추가 채택"을 이끌고 있다.**
→ 🔑 `Q` — **메모리 가격·용량 제약이 CXL 채택의 동인**이라는 인과. 🔗 **메모리 슈퍼사이클(000660·MU)의 2차 수혜 경로**로 등재. ⚠️ 가속기당 콘텐츠 수치는 미제시

**Q6. Chris Caso (Wolfe Research)** — *"가이던스 상향은 캐파를 더 확보한 결과인가, 고객 예측에 더 확신을 갖게 된 결과인가?"*
→ **Koopmans(COO)**: 🔑 **"소수의 핵심 공급사와의 매우 긴밀한 관계"**로 캐파를 관리하며 **"5년 예측"**과 **"$10억 선급금"**으로 산업 제약 국면에서 할당을 확보. **"말한 것을 실제로 해내는 것이 공급사 신뢰를 쌓는다."**
→ 🔑 **§2-B 변화 4의 정본** — 🔗 AVGO Tan **"공급 확보는 돈만 던진다고 되는 게 아니다"**(doc#2536 Q5)와 같은 논리. **팹리스가 캐파 할당을 사는 방식이 업계 표준화**되고 있다

**Q7. Ross Seymore (Deutsche Bank)** — *"올해 성장률이 30% → 50% → 70% 초과로 올라갔다. 왜 내년엔 하이퍼스케일러 CapEx 성장률 근처로 둔화하나?"*
→ **Murphy**: **"이것이 오늘 시점의 우리 위치"**라면서 상방 동인을 나열 — **DSP 확장 · 1.6T의 높은 콘텐츠 · DCI 램프 · 리타이머 · AC · 약 $3억 규모 스케일업 옵틱스**. 🔑 결론: **"선택지가 많다. 분명히 상방 편향이 있다."**
→ 🔑 **§2-B 변화 3의 정본** — **회사가 자기 가이던스를 스스로 보수적이라고 규정**했다. §8 반증 대상 기준선

**Q8. Tore Svanberg (Stifel)** — *"구리·광·MPO·CTO 등 여러 동학 중 최근 상방이 가장 컸던 제품 2~3개는?"*
→ **Murphy**: **Celestial AI 통합을 "홈런"**으로 규정 — **"XPU에서 스위치까지 엔드투엔드 솔루션"**을 가능하게 한다. 실리콘포토닉스 실적: 🔑 **"4세대에 걸친 150억 시간의 디바이스 데이터."** die-to-die·스위칭은 양산 준비 상태. 스케일업 네트워크는 **"1세대, 그라운드 제로"**로 활주로가 크다.
→ 🔑 `Capture STRENGTHENED` — **신생 실리콘포토닉스 진입자와 구분되는 정량 실적**(150억 시간)이 처음 제시됐다. 🔗 **LITE·COHR와의 경쟁 축** — MRVL은 부품이 아니라 **DSP+포토닉스 통합**으로 들어온다

**Q9. Serene E (RBC)** — *"스케일아웃은 확립된 시장이고 우리는 신흥 사업자다. 스케일업(eSUN·NVLink·UALink)의 2028년 이후 기회는?"*
→ **Murphy**: 스케일아웃 스위칭은 **내년 $10억 매출** 겨냥(Innovium 인수 후 5년 전 거의 0에서). 스케일업은 **"더 큰 기회"**이고 🔑 **"시장 점유율이 아직 확립되지 않았다"**. 광범위한 역량·실적이 필요. 🔑 **"스케일업 스위칭은 전부 상방(all upside)이고 현 가이던스에 반영돼 있지 않다."**
→ 🔑 **§2-B 변화 1의 정본(후반)** — **가이던스 미반영 상방이 명시적으로 존재**한다. 🔗 **UALink·eSUN·NVLink Fusion 3개 표준 모두 지원 = 표준 전쟁 중립** — 어느 쪽이 이겨도 콘텐츠를 판다

**Q10. Srini Pajjuri (Raymond James)** — *"기존 고객 확장·XPU attach·신규 tier-1 중 어느 것이 가장 큰가?"*
→ **Murphy**: 세 동인이 **"약 3분의 1씩"** 유지되며 모두 전년 대비 **규모가 커졌다**. **FY2028 커스텀 매출 "2배 초과"**이며 **"대략 같은 비율"**이 유지된다.
→ 🔑 `Q` — **§2-B 3분의 1 프레임의 확인 문답.** 성장이 **단일 고객·단일 프로그램에 걸려 있지 않다**는 회사의 핵심 방어 논리

> ⚠️ **이번 콜의 답변 회피 2건 (기록 자체가 정보다)**
> ① **신규 tier-1 XPU 고객의 독점 여부·실명** — Arya가 직접 물었으나 미답.
> ② **XPU·attach의 칩 종류·용도** — Rakers 측 질문에 **"현 시점에 추가로 밝힐 내용은 없다"**로 명시적 거부.

**Provenance**: `doc#2541`(**FY27Q1 어닝콜 전사 전문 — Prepared Remarks + Q&A 10문 전수, fool.com, 2026-08-27 적재** ⚓ §2-B/2-C/2-D 축) · `doc#1103`·`doc#1104` (FY27 1Q 어닝 정리) · `doc#2360` (구글 워런트 8-K)

---

## 3. Expectations Map

> as_of 2026-08-25.

| Driver | Market / Street Assumption | Research View | Difference | Current Decision |
|---|---|---|---|---|
| **Q (커스텀)** | 컨센 FY27 $115억/FY28 $168억 (JPM doc#2375 기준) | 워런트 전량 베스팅 함의 매출은 컨센 대비 큰 상향 — CY28 AI ASIC $110억 목표 초과 가능 | 구글 어태치의 규모·기간을 시장보다 크게 봄 | **STRENGTHENED** |
| **Capture (vs AVGO)** | AVGO 1위 구도 불변 — MRVL은 2위 프리미엄 할인 | 핵심 TPU가 아닌 인접칩 어태치로 별도 슬롯 확보 — 제로섬 아님 (JPM '우호적 이종화') | 경쟁 프레임을 socket 단위로 분해해서 봄 | **NO CHANGE** |
| **P (CXL)** | CXL은 아직 니치 — 컨센 미반영 다수 | CXL TAM $200억·M/S 50%+ 시나리오는 시총 +50% 상방 (doc#2372) — 진짜 해자는 메모리 풀링 IP | 밸류 동력의 무게중심을 칩디자인→메모리로 이동 | **WATCH** |
| **Duration** | FY29 $100억 커스텀에 회의적 시각 병존 | 수주 기반 + 워런트 계약 구조가 duration을 계약으로 고정 | 가시성의 질이 과거 사이클과 다름 | **STRENGTHENED** |

---

## 4. Active Claims

### C-001 — 커스텀 XPU+어태치 FY29 $100억 경로는 수주 기반이다

**Affected Drivers**: `Q / Duration`
**Status**: `STRENGTHENED`
**Origin**: management
**Dates**: evidence 2026-08-20 · reviewed 2026-08-26 · changed 2026-08-20

**Claim**: FY27~FY29 전망은 이미 수주·확정된 디자인만 반영하며, 모든 미국 하이퍼스케일러와 engagement를 보유 — 신규 수주는 전부 upside다.
**Support**: `doc#1104` — "제시한 전망은 확정 design만 기반", 50개+ 기회 중 수주 전환 지속. `doc#1103` — FY28 커스텀 3×1/3 구성 전 축 확대. `doc#2360` — 구글 워런트로 최대 규모 고객 약정 추가.
**Counterevidence**: 커스텀 프로그램의 세대 교체 시 소켓 상실 리스크(하이퍼스케일러 내재화·경쟁 전환)는 상존.
**Implied Financial Impact**: FY28 $165억 달성 확률 상승 — 매출 가시성의 질적 개선.
**Next Proof**: F2Q27 실적(Trainium 3 양산 기여)·Maia 3nm 2H26 양산 확인.

### C-002 — 구글 워런트는 TPU 인접칩 어태치 매출의 구조적 확대 계약이다

**Affected Drivers**: `Q / Capture / Duration`
**Status**: `STRENGTHENED` (신규 2026-08-20)
**Origin**: management (SEC 8-K) + street
**Dates**: evidence 2026-08-20 · reviewed 2026-08-26 · changed 2026-08-20

**Claim**: 2026-08-18 구글 워런트(5,896만주, 행사가 $206.58, 240트랜치 — 트랜치당 맞춤제품 $5억 구매마다 권리 발생)는 역산 시 최대 약 $1,200억 구매약정 구조로, AI 추론 오프로드·스토리지·NIC·CXL 인터페이스 등 광범위 어태치 매출을 계약으로 고정한다.
**Support**: `doc#2360` — SEC 8-K 원문. `doc#2375` — JPM: FY33까지 연평균 약 $192억 잠재 매출, CY28 EPS $11.00 경로.
**Counterevidence**: `doc#2372` — 워런트는 대체가능성(드랍 리스크) 존재 — 트랜치 발생은 구글의 실제 구매에 달림. 핵심 TPU 수주가 아닌 인접칩 성격.
**Implied Financial Impact**: 전량 베스팅 시 FY27/28 컨센($115억/$168억) 대비 큰 상향 여지. 단 희석(최대 5,896만주) 동반.
**Next Proof**: 분기별 트랜치 발생(=구글 구매 $5억 단위) 공시 추적.

### C-003 — CXL 메모리 풀링이 칩디자인을 넘어서는 제2 밸류 동력이다

**Affected Drivers**: `P / Capture`
**Status**: `WATCH`
**Origin**: street + hun
**Dates**: evidence 2026-08-20 · reviewed 2026-08-26 · changed 2026-08-20

**Claim**: KV cache 오프로드·메모리 전용 랙 등장 시 PCIe 대신 CXL 채택이 필연이며, MRVL(XConn 인수·컨트롤러·스위치)이 최대 수혜 포지션이다.
**Support**: `doc#1569` — UBS: CXL 매출 CY27 $1.0B·CY28 $2.0B, 하이퍼스케일러 2곳+5개 프로그램. 🗣️[훈] "메모리 전용 랙 등장 시 CXL 표준 채택 필연". `doc#1104` — XPU attach만으로 수년 내 $10억↑, 메모리 사이클이 채택 가속. `doc#2372` — CXL TAM $200억·M/S 50%+ 시 시총 +$1,000억 상방 `[추정 — 텔레그램 opinion]`.
**Counterevidence**: CXL 생태계 채택 속도 불확실 — 하이퍼스케일러가 자체 설계로 우회할 가능성.
**Implied Financial Impact**: 실현 시 FY28 이후 매출·멀티플 동시 상방 — 현재 컨센 미반영.
**Next Proof**: CXL 프로그램 양산 전환 발표, 메모리 전용 랙 아키텍처 채택 사례.

### C-004 — Scale-up switching·CPO는 가이던스 미반영 greenfield 옵션이다

**Affected Drivers**: `Q / Duration`
**Status**: `NO CHANGE`
**Origin**: management
**Dates**: evidence 2026-07-07 · reviewed 2026-08-26 · changed 2026-05-28

**Claim**: Scale-up switching은 FY28 $165억에 사실상 미반영이며, Celestial(포토닉)+Teralynx(T100 102.4T)+전 표준(eSUN·UALink·NVLink Fusion) 베팅으로 다음 사이클 진입권을 확보했다.
**Support**: `doc#1104` — "scale-up은 승자 미결 greenfield, CPO·NPO 채택이 더 강하고 sticky". `doc#1202` — T100 업계 최초 102.4Tbps AI 전용, 전력 25% 우위.
**Counterevidence**: `doc#1627` — MS: MRVL CPO 양산은 2028년 — NVDA·AVGO·AMD(2026~27) 대비 한 세대 늦음. AVGO Tomahawk·ALAB Scorpio 직접 경쟁.
**Implied Financial Impact**: FY29+ 매출의 상방 옵션 — 현재 추정에 넣지 않음.
**Next Proof**: T100 고객 샘플링→디자인윈, Celestial 기반 Tier1 scale-up 프로그램 공식화.

### C-005 — 고객 집중·경쟁 리스크가 멀티플의 상한을 규정한다

**Affected Drivers**: `Capture / Margin`
**Status**: `WATCH`
**Origin**: synthesized
**Dates**: evidence 2026-08-20 · reviewed 2026-08-26 · changed 2026-08-26

**Claim**: AWS(Trainium)·MS(Maia)·구글 3사 의존 구조는 프로그램 하나의 이탈이 가이던스를 흔드는 비대칭 리스크이며, AVGO 대비 규모 열세는 불변이다.
**Support**: 구조적 사실 — 커스텀 매출의 대부분이 3사 프로그램. `doc#1622` — P/E 40배(AMD 30배 대비 프리미엄)로 실망 여지 큼 (as of 7/6).
**Counterevidence**: `doc#2465` — JPM: AVGO/MRVL 우호적 이종화 — 어태치·인접칩은 제로섬 경쟁이 아님. 모든 하이퍼스케일러 engagement가 단일 고객 리스크를 분산.
**Implied Financial Impact**: 프로그램 취소·물량 하향 시 -20~30%급 조정 재현 가능.
**Next Proof**: Trainium 4·Maia 2nm 진행 마일스톤, 고객별 매출 비중 공시.

---

## 5. What Changed

### 2026-08-27 (어닝 3층 소급 — §2-B/2-C/2-D 신설)
- 🧬 **§2-B BM 구조 복원 / §2-C 고객·파트너 증거 / §2-D Q&A 원장(10문 무누락) 신설** — 어닝콜 전사 전문 `doc#2541` 신규 적재. ⚠️ **기준 분기는 FY27Q1**이며 **FY27Q2(2026-09 초 발표 예정)는 아직 반영 대상이 아니다**.
- 🔑 **가이던스 미반영 상방이 명시적으로 2개 확인됐다** — ① **스케일업 스위칭: "전부 상방(all upside)이고 현 가이던스에 반영돼 있지 않다"**(Q9) ② **최근 신규 수주: "목표 달성에 필요한 것이 아니라 보험(insurance policy)"**(Q3). → **FY28 $16.5B는 확정된 디자인만으로 구성된 숫자**다. 이 종목 가이던스의 성격을 규정하는 발견이다.
- 🔑 **회사가 자기 가이던스를 스스로 보수적이라고 규정했다**(Q7). Seymore가 *"인터커넥트 성장률이 30%→50%→70% 초과로 올라갔는데 왜 내년엔 둔화하나"*라고 묻자 Murphy: **"선택지가 많다. 분명히 상방 편향이 있다."** §8 반증 대상 기준선으로 등재.
- 🔑 **커스텀 성장의 "3분의 1 × 3" 구조가 두 번 확인됐다**(Q1·Q10) — 기존 프로그램 / XPU-attach 10건 초과 / 신규 tier-1. Q10에서 **FY28 2배 초과에서도 같은 비율 유지**를 명시. **성장이 단일 고객에 걸려 있지 않다**는 회사의 핵심 방어 논리다.
- 🔑 **attach 수주의 기술적 근거가 SRAM으로 특정됐다**(Q2) — *"업계 최고 수준의 SRAM 설계 역량과 IP"*, 계보는 Avera·IBM·GlobalFoundries. 🔗 **AVGO Tan이 "XPU에 SRAM을 넣고 CPU 코어를 임베드해 GW당 콘텐츠가 오른다"**고 말한 것(doc#2536 Q13)과 **같은 기술 방향**이다.
- 🆕 **CXL 채택의 동인이 "메모리 아키텍처 우려"로 특정됐다**(Q5) — 🔗 **메모리 슈퍼사이클(000660·MU)의 2차 수혜 경로**로 등재. ⚠️ 가속기당 콘텐츠 수치는 미제시.
- 🔗 **NVIDIA는 경쟁자가 아니라 3축 파트너**(옵틱스·NVLink Fusion·AI RAN)로 정리됐고, 스케일업에서 **UALink·eSUN·NVLink Fusion을 모두 지원 = 표준 전쟁 중립**. 어느 표준이 이기든 콘텐츠를 판다.
- 🔗 **공급 확보 방식이 AVGO와 동일 계열**(Q6) — 소수 핵심 공급사 · 5년 예측 · **FY27 약 $10억 선급금**. 팹리스가 캐파 할당을 사는 방식이 업계 표준화되고 있다.
- ⚠️ **답변 회피 2건 명기** — 신규 tier-1 독점 여부·실명 / XPU·attach의 칩 종류("현 시점에 추가로 밝힐 내용은 없다").

### 2026-08-26 (구조 전환)
- 위키를 company-claim-v1로 전환 (구본 → `log/MRVL_body_archive_2026-08-26.md`). §2 Actuals를 FY27 1Q 어닝콜 원문(doc#1103·1104)으로 재구축. C-005(고객 집중) 신설로 Bear 축 명시화.

### 2026-08-20~25
| Claim | Delta | 이유 |
|---|---|---|
| C-002 구글 워런트 | **신설·Strengthened** | 8-K 원문(doc#2360) + JPM 정량화(doc#2375) |
| C-003 CXL | **Watch 강화** | Dean's Ticker가 CXL을 제1 밸류 동력으로 재프레임(doc#2372) |
| C-001 수주 기반 | **Strengthened** | 워런트가 수주 가시성 논지를 계약 구조로 보강 |

### What Did NOT Change
- **워런트 뉴스만으로 FY28 매출 추정을 상향하지 않음** — 트랜치 발생(실구매)이 증거 기준.
- **CPO 한 세대 지각(doc#1627)만으로 scale-up 옵션 가치를 제거하지 않음** — scale-up은 2028+ 시장이라 진입 시점 재평가 여지.

---

## 6. Counterevidence Dashboard

| Counter Claim | 상태 | Affected Driver | 현재 판정 |
|---|---|---|---|
| 구글 워런트 드랍 가능성 | **Active** | Q / Duration | 트랜치 발생 추적으로 검증 — C-002 |
| AVGO 규모 우위·경쟁 | **Active** | Capture | 이종화 프레임으로 상쇄 중 — 단일 socket 경합 시 재평가 |
| AWS/MS 프로그램 집중 | **Active** | Q | 3×1/3 구성이 완충 — 개별 프로그램 마일스톤 감시 |
| CPO 진입 한 세대 지각 | **Active** | Q (FY29+) | scale-up 시장 개화 시점과의 시차가 관건 |
| 밸류에이션 프리미엄 (P/E 40배, as of 7/6) | **Active** | — | 실적 미스 시 하방 증폭 요인 |

---

## 7. Open Questions

1. 구글 워런트 트랜치의 실제 발생 속도는? (분기 $5억 단위 몇 개씩?)
2. F2Q27에서 Trainium 3 양산 기여가 가이던스($27억)를 확인하는가?
3. Maia 3nm 2H26 양산·Trainium 4 컨텐츠 확대(CPO+NVLink I/O+UALink)의 실측 규모는?
4. CXL 프로그램 5개의 양산 전환 시점과 단가는?
5. Scale-up switching 첫 대형 디자인윈은 어느 표준(eSUN/UALink/NVLink Fusion)에서 나오는가?

---

## 8. Next Observable Proof

### F2Q27 Earnings (임박)
- 매출 $27억±5% 달성 여부·DC 성장 분해
- 커스텀(Trainium 3)·인터커넥트(+70% 경로) 확인
- FY28 $165억 가이던스 유지/상향
- 구글 워런트 관련 최초 코멘트

### External
- 구글 트랜치 발생 공시
- T100 샘플링 피드백·CPO 로드맵
- AWS/MS 차세대 ASIC 프로그램 뉴스플로

---

## 9. Thesis Breakers — 🗡️ 반증 조건

다음 중 하나가 확인되면 현재 Research View를 재작성한다. (데일리 Step 6 대조 대상)

1. **Trainium/Maia 등 주력 커스텀 프로그램의 취소·차세대 미수주** 확인.
2. 구글 워런트 트랜치가 **4개 분기 연속 미발생** — 약정 구조의 실효성 상실.
3. 1.6T DSP 점유율(60~65%)의 의미 있는 붕괴 — 인터커넥트 +70% 경로 이탈.
4. FY28 $165억 가이던스 하향 또는 분기 매출 QoQ 역성장.
5. CXL 프로그램이 양산 전환 없이 취소 — 제2 동력 소멸.
6. Scale-up switching에서 AVGO/ALAB 독식 구도 확정 (MRVL 디자인윈 부재 장기화).

---

## 10. Research State Metadata

```yaml
ticker: "MRVL"
state_type: company
model: company-claim-v1
active_claim_cap: 7
last_actual_period: "FY2027Q1"
earnings_call_qa: "전 10문 무누락 — §2-D 원장 (doc#2541). 질문자·소속 전수 확인. ⚠️ 답변 회피 2건(신규 tier-1 독점 여부·XPU 칩 종류) 명기. FY27Q2 콜은 2026-09 초 예정 — 미반영"
source_doc: "doc#2541 — FY27Q1 어닝콜 전사 전문 (2026-08-27 적재, earnings ★5 / quarterly)"
next_major_review: "F2Q27 earnings (2026-08 말)"
last_evidence_at: 2026-08-25
last_reviewed_at: 2026-08-26
last_changed_at: 2026-08-26
```

---

## 11. Source Map

### Primary / Earnings
- `doc#1103` — FY27 1Q 어닝 (실적·가이던스)
- `doc#1104` — FY27 1Q Q&A 원문 (경영진 발언)
- `doc#2360` — 구글 워런트 8-K (SEC 원문)

### Structural Support
- `doc#2375` — JPM 워런트 정량화 (FY33 연평균 $192억)
- `doc#1569` — UBS CXL 전망 + 훈 코멘트
- `doc#1202` — Teralynx T100 발표
- `doc#2465` — JPM 우호적 이종화 프레임

### Counterevidence
- `doc#2372` — Dean's: 워런트 드랍 리스크 (동시에 CXL 상방론)
- `doc#1627` — MS CPO 진입 시점 열위
- `doc#1622` — Citi 밸류에이션 프리미엄

---

## 12. Links

**테마 위키**: [ICMS — ASIC](../themes/ICMS_ASIC.md) · [ICMS 광통신·네트워킹](../themes/ICMS_networking.md) · [AI 데이터센터 인프라](../themes/AI_datacenter.md)
**관련 종목 위키**: [NVDA](NVDA.md) · [AVGO](AVGO.md) · [ALAB](ALAB.md) · [TSM](TSM.md) · [ALCHIP](ALCHIP.md)
**공급망 관계 (정본 = graph)**: `python3 watchlist_db/global_stocks_db.py show MRVL`
**Decision layer (Research ≠ Portfolio)**: 미편입 관심종목 — 비중·손절 → `memory/portfolio.md` / `memory/stop-loss.md` · LP 판결 이력 → 노션 데일리

<!-- EOF MRVL -->
