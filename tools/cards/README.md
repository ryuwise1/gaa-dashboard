# 톡방 보고용 PNG 카드 — GDI+ PowerShell 스크립트

보드 다크 테마와 같은 팔레트로 그리는 1000px 폭 카드. 카카오톡·발표 자료용.
Windows 내장 PowerShell 5.1 + .NET System.Drawing만 쓰므로 별도 설치가 없다.

| 파일 | 내용 | 마지막 사용 |
|---|---|---|
| `exec-card.ps1` | 오늘 밤 집행 예정 목록 (번호 · 금액 · 근거 · 승인 상태 칩) | 9/8 |
| `demo-card.ps1` | 9/11 20기 발표 시나리오 8단계 타임라인 | 9/8 |
| `rebal-card.ps1` | 수시 리밸런싱 보고 (체결 · 결정 · 재원 · 현황 스탯) | 9/7 |
| `security-card.ps1` | AI 보안 편입 제안 (스토리 · 종목 2개 · 실행안) | 9/7 |

새 카드는 가장 비슷한 것을 복사해서 `$rows` 배열과 헤더 문구만 바꾸면 된다.

## 실행

```powershell
powershell -ExecutionPolicy Bypass -File tools\cards\exec-card.ps1
# → out\GAA_집행예정_260908.png  (out/ 은 gitignore)
```

## 반드시 지킬 것 — PS 5.1 함정 3개

1. **파일은 UTF-8 with BOM** 이어야 한다. BOM이 없으면 한글이 전부 깨져 그려진다.
   에디터로 저장했다면 실행 전에 한 번 재인코딩:
   ```powershell
   $p='tools\cards\exec-card.ps1'
   [IO.File]::WriteAllText($p, [IO.File]::ReadAllText($p, [Text.UTF8Encoding]::new($false)), [Text.UTF8Encoding]::new($true))
   ```
2. **Font 생성자는 캐스팅** — `New-Object System.Drawing.Font('Malgun Gothic', [single]$size, [System.Drawing.FontStyle]$style)`.
   캐스팅을 빼면 "ambiguous overloads" 오류.
3. **`$` 가 들어가는 문구는 작은따옴표** — `'약 $17,360 회수'`. 큰따옴표면 변수로 해석된다.

## 문체 규칙

카드 문구는 보드와 같은 **공식 보고서체(~습니다)**, 담백하게. 큰 숫자 콜아웃·감성 카피·과장 표현 금지 (팀장 지시).
승인 전 집행 건은 반드시 "승인 대기" 칩으로 구분한다.

## 레이아웃 메모

- 캔버스 1000px, 좌우 여백 46px, 카드 폭 908px, 모서리 반경 14
- 색: 배경 18/21/28 · 카드 28/33/43 · 헤어라인 50/57/70 · 본문 238/241/246 · 보조 148/158/172 · 파랑 96/165/250 · 수익 240/68/82 · 앰버 245/166/35
- 높이(`$H`)가 부족하면 푸터가 잘린다 — 행을 추가했으면 `$H`도 늘릴 것 (9/8 사고)
