Add-Type -AssemblyName System.Drawing

$W = 1000; $H = 1360
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
$green   = [System.Drawing.Color]::FromArgb(63, 182, 139)
$amber   = [System.Drawing.Color]::FromArgb(245, 166, 35)
$gBg = New-Object System.Drawing.SolidBrush($bg)
$gCard = New-Object System.Drawing.SolidBrush($card)
$bInk = New-Object System.Drawing.SolidBrush($ink)
$bMut = New-Object System.Drawing.SolidBrush($mut)
$bBlue = New-Object System.Drawing.SolidBrush($blue)
$bGain = New-Object System.Drawing.SolidBrush($gain)
$bGreen = New-Object System.Drawing.SolidBrush($green)
$bAmber = New-Object System.Drawing.SolidBrush($amber)
$pHair = New-Object System.Drawing.Pen($hair, 1)
$pLine = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 96, 165, 250), 2)

$g.FillRectangle($gBg, 0, 0, $W, $H)

function F($size, $style) { New-Object System.Drawing.Font('Malgun Gothic', [single]$size, [System.Drawing.FontStyle]$style) }
$fLogo  = F 28 'Bold'
$fH1    = F 15 'Bold'
$fSec   = F 12.5 'Bold'
$fStep  = F 13.5 'Bold'
$fBody  = F 10.5 'Regular'
$fSmall = F 9.5 'Regular'
$fNum   = F 15 'Bold'
$fChip  = F 9 'Bold'

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
  $w2 = [int]$sz.Width + 16
  $path = RoundRect $x $y2 $w2 26 13
  $g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(38, $brush.Color))), $path)
  $g.DrawString($text, $fChip, $brush, ($x+8), ($y2+5))
  return $w2
}

# ── 헤더
$g.DrawString('GLIF', $fLogo, $bBlue, 46, 38)
$g.DrawString('자산운용팀', $fLogo, $bInk, 150, 38)
$g.DrawString('금요일 발표 시나리오', $fH1, $bInk, 700, 40)
$g.DrawString('9/11 (금) · 보드 라이브 시연 · 약 10분', $fBody, $bMut, 700, 68)
$g.DrawLine($pHair, 46, 102, 954, 102)

# ── 오프닝
$y = 116
$path = RoundRect 46 $y 908 56 12
$g.FillPath($gCard, $path); $g.DrawPath($pHair, $path)
$g.DrawString('오프닝 (30초)', $fChip, $bAmber, 66, ($y+8))
$g.DrawString('"뭘 샀는지, 왜 샀는지, 얼마 벌었는지, 다음에 뭘 할지 — 전부 사이트 하나에 있습니다"', $fBody, $bInk, 66, ($y+27))
$y += 72

# ── 단계 8개 (타임라인)
$steps = @(
  @{ n='1'; t='공개판 첫 화면';        a='접속만';                m='"+5%대, S&P를 4%p 앞서는 중" — 숫자로 시선부터 잡기'; c=$bBlue; ch='공개판' },
  @{ n='2'; t='투자 스토리';           a='비중 바 → 펼치기';       m='"AI 사이클을 시간 순서로 — 지금은 메모리, 다음은 보안. 나머지는 틀렸을 때의 장치"'; c=$bBlue; ch='공개판' },
  @{ n='3'; t='매수·매도 플랜';        a='SK하이닉스 클릭';        m='"모든 종목엔 왜가 붙어 있습니다" — 근거 하나만 읽기'; c=$bBlue; ch='공개판' },
  @{ n='4'; t='매매 내역 + 배당';      a='매도 1건 + 하단 배당';   m='"팔 때도 근거를 남기고, 배당 $743은 자동 재투자됩니다"'; c=$bBlue; ch='공개판' },
  @{ n='5'; t='AP·MP';                a='표 훑기만';              m='"감이 아니라 규칙 — 목표 ±25% 벗어나면 표가 알려줍니다"  (시간 없으면 이 단계 생략)'; c=$bBlue; ch='공개판' },
  @{ n='6'; t='캘린더';               a='9월 월간 → 9/8 클릭';    m='"시장 일정 위에 우리 회의·매매가 겹쳐 보입니다. 12월까지" — 반응 최고 장면'; c=$bBlue; ch='공개판' },
  @{ n='7'; t='팀 전용 입장';          a='?team → 로그인 시연';    m='GLIF 로고 뜨는 순간이 연출 포인트. 오늘의 분석·회의록 성적표 딱 2개만'; c=$bGreen; ch='팀 전용' },
  @{ n='8'; t='클로징 — 알파 ③ 제안';  a='스토리 화면으로 복귀';   m='"코어·현금 43%는 여러분 몫 — 테제+종목+반증 조건이 오면 보드에 이름이 걸립니다. $70,000 대기 중"'; c=$bGain; ch='클로징' }
)
$g.DrawLine($pLine, 78, ($y+10), 78, ($y + 8*118 - 30))
foreach ($st in $steps) {
  $path = RoundRect 108 $y 846 104 12
  $g.FillPath($gCard, $path); $g.DrawPath($pHair, $path)
  # 타임라인 번호 원
  $g.FillEllipse((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(50, $st.c.Color))), 57, ($y+30), 42, 42)
  $sz = $g.MeasureString($st.n, $fNum)
  $g.DrawString($st.n, $fNum, $st.c, (78 - $sz.Width/2), ($y+38))
  # 제목 + 동작 + 멘트
  $g.DrawString($st.t, $fStep, $bInk, 130, ($y+13))
  $tw = $g.MeasureString($st.t, $fStep).Width
  $g.DrawString(('클릭: ' + $st.a), $fSmall, $bBlue, (130 + $tw + 14), ($y+19))
  $g.DrawString($st.m, $fBody, $bMut, 130, ($y+48))
  [void](Chip $st.ch $st.c 862 ($y+13))
  $y += 118
}
$y += 4

# ── 준비물
$g.DrawString('발표 전 준비', $fSec, $bBlue, 46, $y)
$y += 28
$path = RoundRect 46 $y 908 78 12
$g.FillPath($gCard, $path); $g.DrawPath($pHair, $path)
$g.DrawString('· 발표용 브라우저는 시크릿 창으로 — 7단계에서 로그인 화면이 라이브로 뜨게', $fBody, $bMut, 66, ($y+12))
$g.DrawString('· 20기 전체 공유는 공개판 링크만, 비밀번호는 자산운용팀 합류자에게만 별도 전달', $fBody, $bMut, 66, ($y+42))
$y += 96

# ── 푸터
$g.DrawLine($pHair, 46, $y, 954, $y)
$y += 14
$g.DrawString('설계: 숫자 훅(1) → 근거의 문화(2~4) → 시스템 운용(5~6) → 팀 도구(7) → 참여 제안(8)  |  gaa-dashboard-eight.vercel.app', $fSmall, $bMut, 46, $y)

$outDir = Join-Path $PSScriptRoot '..\..\out'; New-Item -ItemType Directory -Force $outDir | Out-Null
$out = Join-Path $outDir 'GAA_발표시나리오_260911.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "saved: $out"
