Add-Type -AssemblyName System.Drawing

$W = 1000; $H = 848
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
$fName  = F 14.5 'Bold'
$fBody  = F 11 'Regular'
$fNum   = F 14 'Bold'
$fSmall = F 10 'Regular'
$fChip  = F 10 'Bold'
$fBig   = F 22 'Bold'

function RoundRect($x, $y, $w, $h, $r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x, $y, $r*2, $r*2, 180, 90)
  $p.AddArc($x+$w-$r*2, $y, $r*2, $r*2, 270, 90)
  $p.AddArc($x+$w-$r*2, $y+$h-$r*2, $r*2, $r*2, 0, 90)
  $p.AddArc($x, $y+$h-$r*2, $r*2, $r*2, 90, 90)
  $p.CloseFigure()
  return $p
}
function Chip($text, $brush, $x, $y2) {
  $sz = $g.MeasureString($text, $fChip)
  $w2 = [int]$sz.Width + 20
  $path = RoundRect $x $y2 $w2 30 15
  $g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, $brush.Color))), $path)
  $g.DrawString($text, $fChip, $brush, ($x+10), ($y2+6))
}

# ── 헤더
$g.DrawString('GLIF', $fLogo, $bBlue, 46, 40)
$g.DrawString('자산운용팀', $fLogo, $bInk, 158, 40)
$g.DrawString('오늘 밤 집행 예정', $fH1, $bInk, 720, 42)
$g.DrawString('9/8 (화) 22:30 미국장 개장 시', $fBody, $bMut, 720, 70)
$g.DrawLine($pHair, 46, 108, 954, 108)

$y = 128
$rows = @(
  @{ no='1'; n='유럽 방산 EUAD 397주 매도'; amt='약 $17,360 회수'; ac=$bAmber
     r='보유 절반 축소 — 휴전 협상 진전으로 재무장 촉매 약화 (현재 −7.3%). 잔여 398주는 협상 번복 대비 유지'; chip='9/7 결정'; cb=$bMut },
  @{ no='2'; n='Rubrik (RBRK) 매수'; amt='$6,250'; ac=$bGain
     r='AI 보안 슬리브 1차 (주력) — GPT-6 Astra 사이버보안 Critical 등급(9/3)으로 복구 인프라 수요 촉매 현실화'; chip='임시회의 승인'; cb=$bMut },
  @{ no='3'; n='CrowdStrike (CRWD) 매수'; amt='$3,750'; ac=$bGain
     r='AI 보안 슬리브 1차 (보조) — EDR 1위, 보호 대상 단위 과금. 2차는 −5% 눌림 또는 Fal.Con 소화 후'; chip='임시회의 승인'; cb=$bMut },
  @{ no='4'; n='코어 VT 150주 매도 + 목표 38.25% → 30%'; amt='약 $24,300 회수'; ac=$bAmber
     r='차기 기수 신규 스토리 재원 확대 — 견해 없는 코어를 줄여 20기 합류(다음 주)에 맞춰 실탄 확보'; chip='승인 대기'; cb=$bAmber }
)
foreach ($t in $rows) {
  $path = RoundRect 46 $y 908 118 14
  $g.FillPath($gCard, $path); $g.DrawPath($pHair, $path)
  $g.DrawString($t.no, $fBig, $bBlue, 64, ($y+38))
  $g.DrawString($t.n, $fName, $bInk, 104, ($y+16))
  $sz = $g.MeasureString($t.amt, $fNum)
  $g.DrawString($t.amt, $fNum, $t.ac, (830 - $sz.Width), ($y+17))
  $g.DrawString($t.r, $fSmall, $bMut, 104, ($y+52))
  Chip $t.chip $t.cb 846 ($y+14)
  $y += 130
}
$y += 6

# ── 집행 후 상태
$g.DrawString('집행 후', $fSec, $bBlue, 46, $y)
$y += 32
$path = RoundRect 46 $y 908 74 14
$g.FillPath($gCard, $path); $g.DrawPath($pHair, $path)
$g.DrawString('차기 기수 재원  약 $70,000 (총자산의 13%+)', $fName, $bInk, 66, ($y+13))
$g.DrawString('현금 + EUAD·VT 매도 대금 − AI 보안 1차. 다음 주 합류하는 20기의 신규 투자 스토리(알파 ③)에 배정합니다.', $fSmall, $bMut, 66, ($y+46))
$y += 96

# ── 푸터
$g.DrawLine($pHair, 46, $y, 954, $y)
$y += 16
$g.DrawString('체결 즉시 보드 원장에 근거와 함께 기록됩니다  |  gaa-dashboard-eight.vercel.app', $fSmall, $bMut, 46, $y)

$outDir = Join-Path $PSScriptRoot '..\..\out'; New-Item -ItemType Directory -Force $outDir | Out-Null
$out = Join-Path $outDir 'GAA_집행예정_260908.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "saved: $out"

