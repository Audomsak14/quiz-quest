param(
  # Next.js will auto-shift ports when 3000 is busy (e.g., 3005).
  [int[]]$Ports = @(3000..3010)
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir = Resolve-Path (Join-Path $scriptDir '..')

Push-Location $frontendDir
try {
  # Kill any lingering Next.js processes that were started from this frontend folder.
  # Port-based cleanup alone can miss orphaned node.exe processes (e.g., crashed watchers).
  try {
    $nextProcs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
      Where-Object {
        $_.CommandLine -and
        ($_.CommandLine -match [regex]::Escape($frontendDir.Path)) -and
        ($_.CommandLine -match '\bnext\b')
      }
    if ($nextProcs) {
      $nextProcs | ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
      }
    }
  }
  catch {
    # Best-effort only
  }

  foreach ($port in $Ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($null -ne $connections) {
      $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
      foreach ($pid in $pids) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
      }
    }
  }

  # .next can be intermittently locked (e.g., OneDrive/antivirus). Retry a few times.
  for ($i = 0; $i -lt 3; $i++) {
    Remove-Item -Recurse -Force .\.next -ErrorAction SilentlyContinue
    if (-not (Test-Path .\.next)) { break }
    Start-Sleep -Milliseconds (300 * ($i + 1))
  }

  npm run dev
}
finally {
  Pop-Location
}
