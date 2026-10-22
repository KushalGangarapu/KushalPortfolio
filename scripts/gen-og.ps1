# scripts/gen-og.ps1 — renders public/og.png (1200x630) with System.Drawing.
# Run: powershell -ExecutionPolicy Bypass -File scripts/gen-og.ps1
# NOTE: keep literals ASCII — PS5.1 reads this file as ANSI; use [char]0xNNNN for glyphs.
#
# PORTABILITY: Windows-only (System.Drawing). On mac/linux, any 1200x630 PNG
# at public/og.png works — or regenerate with `sips`/`convert` or a headless
# browser screenshot of the welcome screen. The layout constants below mirror
# the midnight theme in src/index.css.
Add-Type -AssemblyName System.Drawing

$W = 1200; $H = 630
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAlias'

function Col($hex) { return [System.Drawing.ColorTranslator]::FromHtml($hex) }
$abyss   = Col '#0e0d0b'
$chrome  = Col '#161411'
$raised  = Col '#211d18'
$ink     = Col '#e8e0d4'
$inkdim  = Col '#9a9184'
$inkfaint= Col '#857d72'
$ember   = Col '#ff9e3d'
$sage    = Col '#9ebf9b'
$violet  = Col '#b79aff'

$dash = [char]0x2014   # em dash
$dot  = [char]0x00b7   # middle dot
$blk  = [char]0x2588   # full block cursor

$g.Clear($abyss)

# ---- title bar ----
$g.FillRectangle((New-Object System.Drawing.SolidBrush $chrome), 0, 0, $W, 44)
$dots = @('#e0604f', '#e0a54f', '#7fbf6e')
for ($i = 0; $i -lt 3; $i++) {
    $b = New-Object System.Drawing.SolidBrush (Col $dots[$i])
    $g.FillEllipse($b, 26 + ($i * 22), 15, 13, 13)
    $b.Dispose()
}
$fSm  = New-Object System.Drawing.Font 'Consolas', 15
$fSmB = New-Object System.Drawing.Font 'Consolas', 15, ([System.Drawing.FontStyle]::Bold)
$brushDim = New-Object System.Drawing.SolidBrush $inkdim
$fmtC = New-Object System.Drawing.StringFormat
$fmtC.Alignment = 'Center'
$fmtR = New-Object System.Drawing.StringFormat
$fmtR.Alignment = 'Far'
$g.DrawString("kushal $dash portfolio", $fSm, $brushDim, (New-Object System.Drawing.RectangleF 0, 10, $W, 30), $fmtC)

# ---- explorer rail (right side, subtle) ----
$fTree = New-Object System.Drawing.Font 'Consolas', 15
$brushFaint = New-Object System.Drawing.SolidBrush $inkfaint
$tree = @('EXPLORER', '  README.md', '  projects/', '    wildcat-calendar.md', '    bcss-newspaper.md', '    faithful-flight.md', '    reverse-captcha.md', '  notes/', '  experience.json', '  skills.toml', '  contact.env')
$y = 78
foreach ($line in $tree) {
    $g.DrawString($line, $fTree, $brushFaint, 955, $y)
    $y += 30
}
$pen = New-Object System.Drawing.Pen $raised, 1
$g.DrawLine($pen, 935, 60, 935, $H - 60)

# ---- headline block ----
$fBig  = New-Object System.Drawing.Font 'Consolas', 60, ([System.Drawing.FontStyle]::Bold)
$fMid  = New-Object System.Drawing.Font 'Consolas', 30
$brushInk   = New-Object System.Drawing.SolidBrush $ink
$brushEmber = New-Object System.Drawing.SolidBrush $ember
$brushSage  = New-Object System.Drawing.SolidBrush $sage

$g.FillRectangle((New-Object System.Drawing.SolidBrush $ember), 78, 120, 40, 72)
$g.DrawString('Kushal Gangarapu', $fBig, $brushInk, 132, 120)
$g.DrawString('// a portfolio that is a code editor', $fMid, $brushEmber, 80, 226)
$g.DrawString("file tree $dot git graph $dot real terminal $dot achievements", (New-Object System.Drawing.Font 'Consolas', 21), $brushDim, 80, 288)
$g.DrawString("press F5 for the readable build", (New-Object System.Drawing.Font 'Consolas', 21), $brushDim, 80, 324)

# ---- terminal lines ----
$fTerm = New-Object System.Drawing.Font 'Consolas', 24
$g.DrawString('~ $ kushal --hire', $fTerm, $brushSage, 80, 400)
$g.DrawString("open to: summer 2027 internships $dot builds software his school runs on", (New-Object System.Drawing.Font 'Consolas', 20), $brushDim, 80, 448)
$g.DrawString("~ `$ $blk", $fTerm, $brushEmber, 80, 500)

# ---- status bar ----
$g.FillRectangle((New-Object System.Drawing.SolidBrush $chrome), 0, $H - 34, $W, 34)
$up = [char]0x2191; $dn = [char]0x2193
$g.DrawString("main*   $up`17 ${dn}0", $fSm, $brushDim, 26, $H - 27)
$g.DrawString('F5: build for production', $fSmB, $brushEmber, (New-Object 'System.Drawing.RectangleF' -ArgumentList 0, ($H - 27), ($W - 26), 30), $fmtR)

$bmp.Save("$PSScriptRoot\..\public\og.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "wrote public\og.png"
