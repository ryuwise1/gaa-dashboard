# Render an HTML report (docs/*.html) to a PNG with Edge headless, then trim the empty bottom.
# ASCII-only on purpose so it runs under PowerShell 5.1 without a BOM.
#
#   powershell -ExecutionPolicy Bypass -File tools\render-report.ps1
#   powershell -ExecutionPolicy Bypass -File tools\render-report.ps1 -Html docs\review-260908.html -Out out\review.png
#
# The HTML loads Google Fonts, so an internet connection is needed for the intended typography.
param(
  [string]$Html = "docs\review-260908.html",
  [string]$Out = "out\GAA_review_260908.png",
  [int]$Width = 880,
  [int]$Height = 4200
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$htmlPath = Join-Path $root $Html
$outPath = Join-Path $root $Out
if (-not (Test-Path $htmlPath)) { throw "HTML not found: $htmlPath" }
New-Item -ItemType Directory -Force (Split-Path $outPath -Parent) | Out-Null

$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
if (-not (Test-Path $edge)) { throw "Microsoft Edge not found - install Edge or point `$edge to chrome.exe" }

$raw = Join-Path $env:TEMP ("report-raw-" + [guid]::NewGuid().ToString("N") + ".png")
$url = "file:///" + ($htmlPath -replace "\\", "/")
# Start-Process instead of the call operator: Edge prints a harmless task-manager warning to stderr,
# and under PS 5.1 with ErrorActionPreference=Stop that stderr line would become a terminating error.
$args = @(
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  "--window-size=$Width,$Height", "--virtual-time-budget=9000",
  "--screenshot=$raw", $url
)
Start-Process -FilePath $edge -ArgumentList $args -Wait -WindowStyle Hidden
Start-Sleep -Seconds 2
if (-not (Test-Path $raw)) { throw "Edge produced no screenshot" }

# Trim: scan upward from the bottom until a row differs from the background color.
Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile($raw)
$bgc = $bmp.GetPixel(5, ($bmp.Height - 5))
$bottom = $bmp.Height - 1
for ($y = $bmp.Height - 1; $y -gt 100; $y -= 4) {
  $hit = $false
  for ($x = 40; $x -lt $bmp.Width; $x += 60) {
    $p = $bmp.GetPixel($x, $y)
    if ([Math]::Abs($p.R - $bgc.R) + [Math]::Abs($p.G - $bgc.G) + [Math]::Abs($p.B - $bgc.B) -gt 18) { $hit = $true; break }
  }
  if ($hit) { $bottom = [Math]::Min($y + 50, $bmp.Height - 1); break }
}
$rect = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, ($bottom + 1))
$crop = $bmp.Clone($rect, $bmp.PixelFormat)
$crop.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose(); $crop.Dispose()
Remove-Item $raw -Force
Write-Output ("saved: {0} ({1}x{2})" -f $outPath, $Width, ($bottom + 1))
