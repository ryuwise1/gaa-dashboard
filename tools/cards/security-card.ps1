Add-Type -AssemblyName System.Drawing

$W = 1000; $H = 1092
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'ClearTypeGridFit'

$bg      = [System.Drawing.Color]::FromArgb(18, 21, 28)
$card    = [System.Drawing.Color]::FromArgb(28, 33, 43)
$hair    = [System.Drawing.Color]::FromArgb(50, 57, 70)
$ink     = [System.Drawing.Color]::FromArgb(238, 241, 246)
$mut     = [System.Drawing.Color]::FromArgb(148, 158, 172)
$blue    = [System.Drawing.Color]::FromArgb(96, 165, 250)
$gain    = [System.Drawing.Color]::FromArgb(240, 68, 82)
$amber   = [System.Drawing.Color]::FromArgb(245, 166, 35)
$gBg = New-Object System.Drawing.SolidBrush($bg)
$gCard = New-Object System.Drawing.SolidBrush($card)
$bInk = New-Object System.Drawing.SolidBrush($ink)
$bMut = New-Object System.Drawing.SolidBrush($mut)
$bBlue = New-Object System.Drawing.SolidBrush($blue)
$bGain = New-Object System.Drawing.SolidBrush($gain)
$bAmber = New-Object System.Drawing.SolidBrush($amber)
$pHair = New-Object System.Drawing.Pen($hair, 1)

$g.FillRectangle($gBg, 0, 0, $W, $H)

function F($size, $style) { New-Object System.Drawing.Font('Malgun Gothic', [single]$size, [System.Drawing.FontStyle]$style) }
$fLogo  = F 30 'Bold'
$fH1    = F 15 'Bold'
$fSec   = F 13 'Bold'
$fName  = F 15 'Bold'
$fBody  = F 11 'Regular'
$fNum   = F 15 'Bold'
$fSmall = F 10 'Regular'
$fChip  = F 10 'Bold'

function RoundRect($x, $y, $w, $h, $r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x, $y, $r*2, $r*2, 180, 90)
  $p.AddArc($x+$w-$r*2, $y, $r*2, $r*2, 270, 90)
  $p.AddArc($x+$w-$r*2, $y+$h-$r*2, $r*2, $r*2, 0, 90)
  $p.AddArc($x, $y+$h-$r*2, $r*2, $r*2, 90, 90)
  $p.CloseFigure()
  return $p
}

# ── 헤더
$g.DrawString('GLIF', $fLogo, $bBlue, 46, 40)
$g.DrawString('자산운용팀', $fLogo, $bInk, 158, 40)
$g.DrawString('AI 보안 신규 편입 제안', $fH1, $bInk, 660, 46)
$g.DrawString('회의 검토용 · 2026. 9. 7', $fBody, $bMut, 660, 74)
$g.DrawLine($pHair, 46, 108, 954, 108)

$y = 130
# ── 스토리
$g.DrawString('투자 스토리 — 메인 알파(AI CapEx)의 후행 수혜', $fSec, $bBlue, 46, $y)
$y += 34
$path = RoundRect 46 $y 908 120 14
$g.FillPath($gCard, $path); $g.DrawPath($pHair, $path)
$g.DrawString('"AI를 만들려면 GPU가 필요하다. AI를 쓰려면 보안이 필요하다."', $fName, $bInk, 66, ($y+16))
$g.DrawString('보안 지출은 기존 예산이 아니라 AI 토큰 예산에 붙어 오는 증분이며, 도입이 투자를 앞선다 (CRWD 어닝콜).', $fSmall, $bMut, 66, ($y+56))
$g.DrawString('우리는 이미 AI 인프라(메모리)에 베팅했으므로, 그 도입의 다음 단계 지출을 탐지 층과 복구 층으로 나눠 담는다.', $fSmall, $bMut, 66, ($y+80))
$y += 144

# ── 종목
$g.DrawString('후보 종목 — 층별 분담 (금리 바벨과 같은 구조)', $fSec, $bBlue, 46, $y)
$y += 34

# RBRK 카드
$path = RoundRect 46 $y 908 168 14
$g.FillPath($gCard, $path); $g.DrawPath($pHair, $path)
$g.DrawString('Rubrik (RBRK) — 주력', $fName, $bInk, 66, ($y+14))
$sz = $g.MeasureString('$12,500 (2.5%)', $fNum)
$g.DrawString('$12,500 (2.5%)', $fNum, $bGain, (934 - $sz.Width), ($y+14))
$g.DrawString('복구 층 — 백업이 아니라 "되돌릴 수 있는 상태"를 판다. 에이전트가 실행 권한을 갖는 순간 롤백 인프라가 필수가 된다', $fSmall, $bMut, 66, ($y+52))
$g.DrawString('근거   매출 성장 +38% · 8월 말 실적 서프라이즈 · 기여마진 -3% → 13% 전환 · P/S 12.5 · 애널 목표가 +27% (strong buy)', $fSmall, $bMut, 66, ($y+82))
$g.DrawString('리스크   성장률 궤적 둔화(51→39%) · GAAP 적자 · 최근 20일 +49% 급등(RSI 68)으로 과열 — 분할 필수', $fSmall, $bAmber, 66, ($y+112))
$g.DrawString('반증 조건: 성장률 30% 하회 정착 시 재검토', $fSmall, $bMut, 66, ($y+140))
$y += 182

# CRWD 카드
$path = RoundRect 46 $y 908 168 14
$g.FillPath($gCard, $path); $g.DrawPath($pHair, $path)
$g.DrawString('CrowdStrike (CRWD) — 보조', $fName, $bInk, 66, ($y+14))
$sz = $g.MeasureString('$7,500 (1.5%)', $fNum)
$g.DrawString('$7,500 (1.5%)', $fNum, $bGain, (934 - $sz.Width), ($y+14))
$g.DrawString('탐지 층 — EDR 1위, 텔레메트리 생성권. 좌석이 아니라 보호 대상 과금이라 AI 에이전트가 늘수록 과금 단위가 늘어난다', $fSmall, $bMut, 66, ($y+52))
$g.DrawString('근거   순신규 ARR +51% 사상 최대(기저효과 가설 반증) · Flex 전환 시 ARR +40%, 재약정 시 +25% 추가', $fSmall, $bMut, 66, ($y+82))
$g.DrawString('리스크   P/S 40배 — 품질값을 다 지불하는 가격이라 비중을 작게 · 실적 갭업 후 기대치 리셋 구간', $fSmall, $bAmber, 66, ($y+112))
$g.DrawString('반증 조건: 순신규 ARR이 가이던스 부합에 그치는 분기 2회 연속 시 축소', $fSmall, $bMut, 66, ($y+140))
$y += 182

# PANW 제외 사유
$g.DrawString('검토 후 제외: PANW (P/S 23.7) — 자체 리서치 깊이 부족. 상세 근거는 리포 research/RBRK.md · CRWD.md 참조', $fSmall, $bMut, 66, $y)
$y += 40

# ── 실행안
$g.DrawString('실행안 — 승인 시', $fSec, $bBlue, 46, $y)
$y += 34
$rows = @(
  @{ n='규모'; v='신규 슬리브 "AI 보안" 총 4% ($20,000) — 확보 재원 $68K에서 배정, 잔여 $48K는 차기 기수 몫 유지' },
  @{ n='분할'; v='1차 절반($10K)은 9/8(화) 밤 EUAD 매도 대금으로 집행 (방산 → AI 보안 로테이션) · 2차는 -5% 눌림 또는 Fal.Con(9월 초) 소화 후' },
  @{ n='감시'; v='"메모리 가격 급등이 SW 예산을 잠식하는가" — 우리 메모리 롱과 교차하는 지점을 보안 슬리브가 경고등으로 겸한다' }
)
foreach ($r in $rows) {
  $path = RoundRect 46 $y 908 64 12
  $g.FillPath($gCard, $path); $g.DrawPath($pHair, $path)
  $g.DrawString($r.n, $fName, $bBlue, 66, ($y+18))
  $g.DrawString($r.v, $fSmall, $bMut, 150, ($y+22))
  $y += 76
}
$y += 12

# ── 푸터
$g.DrawLine($pHair, 46, $y, 954, $y)
$y += 18
$g.DrawString('본 자료는 회의 검토용 제안이며, 승인 전까지 집행하지 않습니다.  |  상세: gaa-dashboard-eight.vercel.app', $fSmall, $bMut, 46, $y)

$outDir = Join-Path $PSScriptRoot '..\..\out'; New-Item -ItemType Directory -Force $outDir | Out-Null
$out = Join-Path $outDir 'GAA_AI보안_편입제안_260907.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "saved: $out"
