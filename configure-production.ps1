$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
if (-not (Test-Path $psql)) { throw 'PostgreSQL 17 was not found.' }
Start-Service postgresql-x64-17
$secure = Read-Host 'Enter the PostgreSQL postgres password chosen during installation' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $postgresPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
$env:PGPASSWORD = $postgresPassword
& $psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'SELECT 1;' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not authenticate to PostgreSQL.' }
$dbBytes = New-Object byte[] 32
$sessionBytes = New-Object byte[] 64
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($dbBytes); $rng.GetBytes($sessionBytes) } finally { $rng.Dispose() }
$dbPassword = -join ($dbBytes | ForEach-Object { $_.ToString('x2') })
$sessionSecret = -join ($sessionBytes | ForEach-Object { $_.ToString('x2') })
$roleSql = @'
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kitsune') THEN
    CREATE ROLE kitsune LOGIN PASSWORD '__PASSWORD__';
  ELSE
    ALTER ROLE kitsune WITH LOGIN PASSWORD '__PASSWORD__';
  END IF;
END
$do$;
'@.Replace('__PASSWORD__', $dbPassword)
& $psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 -c $roleSql | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not create the Kitsune database role.' }
$exists = & $psql -h 127.0.0.1 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'kitsune'"
if ($exists.Trim() -ne '1') {
  & $psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE kitsune OWNER kitsune;' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the Kitsune database.' }
}
$envFile = @"
NODE_ENV=production
PORT=8080
TRUST_PROXY=1
DATABASE_URL=postgresql://kitsune:${dbPassword}@127.0.0.1:5432/kitsune
DATABASE_SSL=0
SESSION_SECRET=${sessionSecret}
SESSION_DAYS=30
ALLOWED_ORIGINS=
DB_POOL_SIZE=20
TURN_URLS=
TURN_USERNAME=
TURN_CREDENTIAL=
"@
[IO.File]::WriteAllText((Join-Path $root '.env'), $envFile, (New-Object Text.UTF8Encoding($false)))
Remove-Item Env:PGPASSWORD
Push-Location $root
try {
  npm run db:migrate
  if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
} finally { Pop-Location }
Write-Host ''
Write-Host 'Kitsune PostgreSQL setup completed.' -ForegroundColor Green
Write-Host 'The generated database and session secrets are stored only in .env.'
Write-Host 'The first account registered becomes Owner (Tenko).'
