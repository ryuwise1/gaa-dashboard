Add-Type -AssemblyName System.Drawing

$W = 1000; $H = 1150
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'ClearTypeGridFit'

# 팔레트 — 대시보드 다크 테마 계열
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
$g.DrawString('수시 리밸런싱 보고', $fH1, $bInk, 700, 46)
$g.DrawString('2026. 9. 7 (월)', $fBody, $bMut, 700, 74)
$g.DrawLine($pHair, 46, 108, 954, 108)

$y = 132
# ── 섹션 1: 오늘 체결
$g.DrawString('오늘 체결 — 급등·원화 강세로 이탈한 비중 익절', $fSec, $bBlue, 46, $y)
$y += 36

$trades = @(
  @{ n='삼성전자 24주 매도'; p='@ 268,500원 (당일 +5.1%)'; r='목표 3.0%가 3.9%까지 확대(밴드 ±25% 이탈) — 초과분만 실현, 목표 비중 복원'; amt='+1,467,912원' },
  @{ n='SK하이닉스 3주 매도'; p='@ 1,777,000원 (당일 +7.9%)'; r='밴드 상한(3.75%) 터치분 실현 — 8/5 익절과 동일 규칙, HBM 논지는 유지'; amt='+1,150,500원' }
)
foreach ($t in $trades) {
  $path = RoundRect 46 $y 908 96 14
  $g.FillPath($gCard, $path); $g.DrawPath($pHair, $path)
  $g.DrawString($t.n, $fName, $bInk, 66, ($y+14))
  $g.DrawString($t.p, $fBody, $bMut, 300, ($y+19))
  $g.DrawString($t.r, $fSmall, $bMut, 66, ($y+56))
  $sz = $g.MeasureString($t.amt, $fNum)
  $g.DrawString($t.amt, $fNum, $bGain, (934 - $sz.Width), ($y+14))
  $g.DrawString('실현이익', $fSmall, $bMut, (934 - 62), ($y+48))
  $y += 108
}
$g.DrawString('실현 합계 +2,618,412원 — 두 종목 모두 목표 3.0%로 복원, 추가 매도 계획 없음', $fSmall, $bMut, 66, $y)
$y += 44

# ── 섹션 2: 결정
$g.DrawString('결정 — 손절·룰·보류', $fSec, $bBlue, 46, $y)
$y += 36

function Chip($text, $brush, $x, $y2) {
  $sz = $g.MeasureString($text, $fChip)
  $w2 = [int]$sz.Width + 20
  $path = RoundRect $x $y2 $w2 30 15
  $g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, $brush.Color))), $path)
  $g.DrawString($text, $fChip, $brush, ($x+10), ($y2+6))
  return $w2
}

$decisions = @(
  @{ n='유럽 방산 EUAD — 절반 397주 축소'; r='우크라이나 휴전 협상 진전으로 재무장 촉매 약화 (현재 -7.3%). 협상 번복 가능성을 감안해 전량이 아닌 절반만 축소'; chip='9/8 (화) 밤 집행 예약'; cb='amber' },
  @{ n='장기채 TLT·IEF — 유지'; r='잭슨홀 이후 미 10년물 4.78%까지 상승. 바벨 구조는 유지하되 10년물 5.0% 상향 돌파 시 TLT 절반 축소를 재검토'; chip='룰 설정'; cb='mut' },
  @{ n='KRE 미편입 · VT 잔여 미집행 — 유지'; r='매파 국면 지속으로 지역은행 편입 근거 부족. 코어 잔여분은 아래 신규 재원으로 전환'; chip='보류'; cb='mut' }
)
foreach ($d in $decisions) {
  $path = RoundRect 46 $y 908 100 14
  $g.FillPath($gCard, $path); $g.DrawPath($pHair, $path)
  $g.DrawString($d.n, $fName, $bInk, 66, ($y+14))
  $g.DrawString($d.r, $fSmall, $bMut, 66, ($y+52))
  $chipBrush = if ($d.cb -eq 'amber') { $bAmber } else { $bMut }
  $sz = $g.MeasureString($d.chip, $fChip)
  $cw = [int]$sz.Width + 20
  [void](Chip $d.chip $chipBrush (934 - $cw) ($y+14))
  $y += 112
}
$y += 8

# ── 섹션 3: 차기 기수 재원
$g.DrawString('차기 기수 신규 스토리 재원', $fSec, $bBlue, 46, $y)
$y += 36
$path = RoundRect 46 $y 908 108 14
$g.FillPath($gCard, $path); $g.DrawPath($pHair, $path)
$g.DrawString('확보 완료  약 $68,000 (총자산의 13%)', $fName, $bInk, 66, ($y+16))
$g.DrawString('현금 + 익절 대금 + 코어 미집행분. EUAD 축소 체결 후에는 약 $85,000 (16%)까지 확대됩니다.', $fSmall, $bMut, 66, ($y+52)); $g.DrawString('다음 주 합류하는 후배 기수의 신규 투자 스토리에 배정합니다.', $fSmall, $bMut, 66, ($y+76))
$y += 132

# ── 푸터: 현황
$g.DrawLine($pHair, 46, $y, 954, $y)
$y += 20
$stats = @(
  @{ k='총자산'; v='$524,401' },
  @{ k='운용 개시 후'; v='+4.9%' },
  @{ k='PME 벤치마크 대비'; v='+3.7%p 상회' },
  @{ k='매매 누계'; v='36건' }
)
$x = 46
foreach ($s in $stats) {
  $g.DrawString($s.k, $fSmall, $bMut, $x, $y)
  $g.DrawString($s.v, $fNum, $bInk, $x, ($y+22))
  $x += 232
}
$y += 66
$g.DrawString('상세: gaa-dashboard-eight.vercel.app  |  종목별 근거는 매수·매도 플랜에서 각 종목 선택', $fSmall, $bMut, 46, $y)

$outDir = Join-Path $PSScriptRoot '..\..\out'; New-Item -ItemType Directory -Force $outDir | Out-Null
$out = Join-Path $outDir 'GAA_리밸런싱보고_260907.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "saved: $out"
