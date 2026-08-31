$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Push-Location $root
try {
  npx electron-builder --win nsis
  if ($LASTEXITCODE -ne 0) { throw 'Windows installer build failed.' }
  $version = (Get-Content (Join-Path $root 'package.json') | ConvertFrom-Json).version
  $installer = Join-Path $root "releases\pc\Kitsune-v${version}-Setup.exe"
  $sha = [Security.Cryptography.SHA256]::Create()
  $stream = [IO.File]::OpenRead($installer)
  try { $hash = -join ($sha.ComputeHash($stream) | ForEach-Object { $_.ToString('x2') }) } finally { $stream.Dispose(); $sha.Dispose() }
  [IO.File]::WriteAllText("$installer.sha256", "$hash  Kitsune-v${version}-Setup.exe`n", (New-Object Text.UTF8Encoding($false)))
  Write-Host "Windows installer ready: $installer" -ForegroundColor Green
} finally { Pop-Location }
