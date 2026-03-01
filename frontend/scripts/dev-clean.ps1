param(
  [int[]]$Ports = @(3000, 3003)
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir = Resolve-Path (Join-Path $scriptDir '..')

Push-Location $frontendDir
try {
  foreach ($port in $Ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($null -ne $connections) {
      $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
      foreach ($pid in $pids) {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
      }
    }
  }

  Remove-Item -Recurse -Force .\.next -ErrorAction SilentlyContinue

  npm run dev
}
finally {
  Pop-Location
}
