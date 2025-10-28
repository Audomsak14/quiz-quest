param()
$ErrorActionPreference = 'Stop'

# Resolve project paths relative to this script (frontend/scripts)
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$dest = Join-Path $root 'public/characters'
if(!(Test-Path $dest)) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }

Add-Type -AssemblyName System.Windows.Forms

# Pick boy
$dlg1 = New-Object System.Windows.Forms.OpenFileDialog
$dlg1.Title = 'เลือกไฟล์ผู้ชาย (boy)'
$dlg1.Filter = 'Images|*.png;*.jpg;*.jpeg;*.webp'
if ($dlg1.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { Write-Output 'CANCELLED'; exit 1 }
Copy-Item -LiteralPath $dlg1.FileName -Destination (Join-Path $dest 'boy.png') -Force

# Pick girl
$dlg2 = New-Object System.Windows.Forms.OpenFileDialog
$dlg2.Title = 'เลือกไฟล์ผู้หญิง (girl)'
$dlg2.Filter = $dlg1.Filter
if ($dlg2.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { Write-Output 'CANCELLED'; exit 1 }
Copy-Item -LiteralPath $dlg2.FileName -Destination (Join-Path $dest 'girl.png') -Force

Write-Output "COPIED_OK -> $dest"