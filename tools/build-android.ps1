$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$sdk = if ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } elseif ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { 'C:\Android\android-sdk' }
$buildTools = Get-ChildItem (Join-Path $sdk 'build-tools') -Directory | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
if (-not $buildTools) { throw 'Android SDK build-tools were not found.' }
$zipalign = Join-Path $buildTools.FullName 'zipalign.exe'
$apksigner = Join-Path $buildTools.FullName 'apksigner.bat'
$signing = Join-Path $env:LOCALAPPDATA 'Kitsune\signing'
$keystore = Join-Path $signing 'kitsune-release.jks'
$passwordFile = Join-Path $signing 'keystore-password.txt'
New-Item -ItemType Directory -Force -Path $signing | Out-Null
if (-not (Test-Path $keystore)) {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $password = -join ($bytes | ForEach-Object { $_.ToString('x2') })
  [IO.File]::WriteAllText($passwordFile, $password, (New-Object Text.UTF8Encoding($false)))
  & keytool -genkeypair -keystore $keystore -storepass $password -keypass $password -alias kitsune -keyalg RSA -keysize 4096 -validity 10000 -dname 'CN=Kitsune, O=Kitsune, C=US'
  if ($LASTEXITCODE -ne 0) { throw 'Could not generate the Android signing key.' }
} elseif (-not (Test-Path $passwordFile)) { throw "Android signing password is missing: $passwordFile" }
$password = [IO.File]::ReadAllText($passwordFile).Trim()
Push-Location $root
try {
  npm run android:sync
  if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }
  Push-Location (Join-Path $root 'android')
  try {
    .\gradlew.bat assembleRelease
    if ($LASTEXITCODE -ne 0) { throw 'Android release build failed.' }
  } finally { Pop-Location }
  $unsigned = Join-Path $root 'android\app\build\outputs\apk\release\app-release-unsigned.apk'
  if (-not (Test-Path $unsigned)) { throw 'Unsigned Android APK was not generated.' }
  $version = (Get-Content (Join-Path $root 'package.json') | ConvertFrom-Json).version
  $releaseDir = Join-Path $root 'releases\android'
  New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
  $aligned = Join-Path $releaseDir "Kitsune-v${version}-aligned.apk"
  $signed = Join-Path $releaseDir "Kitsune-v${version}.apk"
  & $zipalign -f -p 4 $unsigned $aligned
  if ($LASTEXITCODE -ne 0) { throw 'APK alignment failed.' }
  & $apksigner sign --ks $keystore --ks-key-alias kitsune --ks-pass "pass:$password" --key-pass "pass:$password" --out $signed $aligned
  if ($LASTEXITCODE -ne 0) { throw 'APK signing failed.' }
  & $apksigner verify --verbose --print-certs $signed
  if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
  Remove-Item $aligned
  $sha = [Security.Cryptography.SHA256]::Create()
  $stream = [IO.File]::OpenRead($signed)
  try { $hash = -join ($sha.ComputeHash($stream) | ForEach-Object { $_.ToString('x2') }) } finally { $stream.Dispose(); $sha.Dispose() }
  [IO.File]::WriteAllText("$signed.sha256", "$hash  Kitsune-v${version}.apk`n", (New-Object Text.UTF8Encoding($false)))
  Write-Host "Android APK ready: $signed" -ForegroundColor Green
  Write-Host "Back up the signing directory: $signing" -ForegroundColor Yellow
} finally { Pop-Location }
