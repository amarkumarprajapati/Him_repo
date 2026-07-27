<#
.SYNOPSIS
    Reset the database and migrations to a fresh state (Windows).

.DESCRIPTION
    Wipes the database, deletes all migration files (keeps __init__.py),
    regenerates migrations, applies them, and creates a superuser.
    Development use only.

.USAGE
    powershell -ExecutionPolicy Bypass -File .\reset-fresh.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# Add PostgreSQL bin to PATH if not already present
$pgDirs = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory -ErrorAction SilentlyContinue | ForEach-Object { Join-Path $_.FullName "bin" }
foreach ($d in $pgDirs) {
    if ((Test-Path $d) -and ($env:PATH -notlike "*$d*")) {
        $env:PATH = "$d;$env:PATH"
    }
}

function Write-Ok($msg)   { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[ERR]  $msg" -ForegroundColor Red }

$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }

function Stop-ProjectPythonProcesses {
    $procs = Get-Process -Name "python", "python3", "pythonw" -ErrorAction SilentlyContinue | Where-Object {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
            $cmdLine -and ($cmdLine -like "*$ScriptDir*")
        } catch { $false }
    }
    foreach ($proc in $procs) {
        Write-Info "Stopping locking process PID $($proc.Id)..."
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    if ($procs) {
        Start-Sleep -Seconds 1
    }
}

# --- Resolve Python ---
$VenvPython = Join-Path $ScriptDir ".venv\Scripts\python.exe"
if (Test-Path $VenvPython) {
    $PYTHON = $VenvPython
    Write-Ok "Using venv Python: $PYTHON"
} else {
    $PYTHON = (Get-Command "python" -ErrorAction SilentlyContinue).Source
    if (-not $PYTHON) {
        $PYTHON = (Get-Command "python3" -ErrorAction SilentlyContinue).Source
    }
    if (-not $PYTHON) {
        Write-Err "Python not found. Please install Python or create a .venv."
        exit 1
    }
    Write-Info "No .venv found, using system Python: $PYTHON"
}

# --- Load .env ---
function Import-DotEnv($path) {
    if (-not (Test-Path $path)) { return }
    Get-Content $path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
            return
        }
        $parts = $line.Split("=", 2)
        [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
    }
}

if (Test-Path (Join-Path $ScriptDir ".env")) {
    Import-DotEnv (Join-Path $ScriptDir ".env")
    Write-Ok ".env loaded"
} elseif (Test-Path (Join-Path $ScriptDir ".env.example")) {
    Import-DotEnv (Join-Path $ScriptDir ".env.example")
    Write-Info ".env not found, loaded .env.example for defaults"
}

$DB_ENGINE = $env:DATABASE_ENGINE
if (-not $DB_ENGINE) { $DB_ENGINE = "postgresql" }

# =============================================================================
# 1. Drop / clear the database
# =============================================================================
Write-Info "Clearing database (engine: $DB_ENGINE)..."

if ($DB_ENGINE -eq "sqlite") {
    $SqliteName = if ($env:SQLITE_NAME) { $env:SQLITE_NAME } else { "db.sqlite3" }
    $SqliteFile = Join-Path $ScriptDir $SqliteName
    if (Test-Path $SqliteFile) {
        try {
            Remove-Item $SqliteFile -Force
            Write-Ok "SQLite file removed: $SqliteFile"
        } catch {
            Write-Info "SQLite file is locked, stopping project Python processes..."
            Stop-ProjectPythonProcesses
            Remove-Item $SqliteFile -Force
            Write-Ok "SQLite file removed after stopping locks: $SqliteFile"
        }
    } else {
        Write-Info "SQLite file not found, skipping"
    }
} else {
    # PostgreSQL — drop and recreate
    $DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "himshravan" }
    $DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "postgres" }
    $DB_PASSWORD = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "" }
    $DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
    $DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }
    $PG_ADMIN_USER = if ($env:PG_ADMIN_USER) { $env:PG_ADMIN_USER } else { "postgres" }
    $PG_ADMIN_PASSWORD = if ($env:PG_ADMIN_PASSWORD) { $env:PG_ADMIN_PASSWORD } else { "postgres" }

    function Invoke-AdminSql($sql) {
        $env:PGPASSWORD = $PG_ADMIN_PASSWORD
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "psql"
        $psi.Arguments = "-h `"$DB_HOST`" -p $DB_PORT -U `"$PG_ADMIN_USER`" -d postgres -v ON_ERROR_STOP=1 -c `"$sql`""
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        $proc = [System.Diagnostics.Process]::Start($psi)
        $proc.WaitForExit()
        $env:PGPASSWORD = $null
        return $proc.ExitCode
    }

    $EscDbUser = $DB_USER -replace "'", "''"
    $EscDbPass = $DB_PASSWORD -replace "'", "''"

    Write-Info "Ensuring PostgreSQL role '$DB_USER' exists..."
    $roleSql = "DO `$$` BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='$EscDbUser') THEN CREATE ROLE `"$DB_USER`" LOGIN PASSWORD '$EscDbPass'; ELSE ALTER ROLE `"$DB_USER`" WITH LOGIN PASSWORD '$EscDbPass'; END IF; END `$$;"
    $exitCode = Invoke-AdminSql $roleSql
    if ($exitCode -ne 0) {
        Write-Err "Could not create/update role '$DB_USER'. Set PG_ADMIN_USER/PG_ADMIN_PASSWORD env vars."
        exit 1
    }

    Write-Info "Terminating active connections for '$DB_NAME'..."
    Invoke-AdminSql "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid();" | Out-Null

    Write-Info "Dropping PostgreSQL database '$DB_NAME'..."
    $exitCode = Invoke-AdminSql "DROP DATABASE IF EXISTS `"$DB_NAME`";"
    if ($exitCode -ne 0) {
        Write-Err "Could not drop DB. Set PG_ADMIN_USER/PG_ADMIN_PASSWORD env vars."
        exit 1
    }

    Write-Info "Creating PostgreSQL database '$DB_NAME'..."
    $exitCode = Invoke-AdminSql "CREATE DATABASE `"$DB_NAME`" OWNER `"$DB_USER`";"
    if ($exitCode -ne 0) {
        Write-Err "Could not create DB."
        exit 1
    }

    Invoke-AdminSql "GRANT ALL PRIVILEGES ON DATABASE `"$DB_NAME`" TO `"$DB_USER`";" | Out-Null
    Write-Ok "PostgreSQL database '$DB_NAME' recreated"
}

# =============================================================================
# 2. Remove all migration files (keep __init__.py)
# =============================================================================
Write-Info "Removing old migration files..."
Get-ChildItem -Path $ScriptDir -Recurse -Filter "*.py" |
    Where-Object {
        $_.FullName -match "\\migrations\\" -and
        $_.Name -ne "__init__.py" -and
        $_.FullName -notmatch "\\.venv\\"
    } |
    ForEach-Object { Remove-Item $_.FullName -Force }

Get-ChildItem -Path $ScriptDir -Recurse -Directory -Filter "__pycache__" |
    Where-Object { $_.FullName -match "\\migrations\\" -and $_.FullName -notmatch "\\.venv\\" } |
    ForEach-Object { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }

Write-Ok "Migration files cleared"

# =============================================================================
# 3. Make fresh migrations for all apps
# =============================================================================
Write-Info "Creating fresh migrations..."
& $PYTHON (Join-Path $ScriptDir "manage.py") makemigrations authentication device telemetry events notifications --noinput
if ($LASTEXITCODE -ne 0) { throw "makemigrations failed" }
Write-Ok "Migrations created"

# =============================================================================
# 4. Apply migrations
# =============================================================================
Write-Info "Applying migrations..."
if (-not (Test-Path (Join-Path $ScriptDir "logs"))) {
    New-Item -ItemType Directory -Path (Join-Path $ScriptDir "logs") | Out-Null
}
& $PYTHON (Join-Path $ScriptDir "manage.py") migrate --noinput
if ($LASTEXITCODE -ne 0) { throw "migrate failed" }
Write-Ok "Migrations applied"

# =============================================================================
# 5. Create superuser from env (non-interactive)
# =============================================================================
$SU_USER  = if ($env:DJANGO_SUPERUSER_USERNAME) { $env:DJANGO_SUPERUSER_USERNAME } else { "admin" }
$SU_PASS  = if ($env:DJANGO_SUPERUSER_PASSWORD) { $env:DJANGO_SUPERUSER_PASSWORD } else { "Admin@123" }
$SU_EMAIL = if ($env:DJANGO_SUPERUSER_EMAIL)    { $env:DJANGO_SUPERUSER_EMAIL }    else { "admin@example.com" }

Write-Info "Creating superuser '$SU_USER'..."
$superuserScript = @"
from authentication.models import User
if not User.objects.filter(username='$SU_USER').exists():
    User.objects.create_superuser(
        username='$SU_USER',
        email='$SU_EMAIL',
        password='$SU_PASS',
        role='SUPER_ADMIN',
    )
    print('Superuser created')
else:
    print('Superuser already exists')
"@
& $PYTHON (Join-Path $ScriptDir "manage.py") "shell" -c "$superuserScript"
if ($LASTEXITCODE -ne 0) { throw "superuser creation failed" }
Write-Ok "Superuser ready: $SU_USER"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Fresh reset complete!  Run: .\bootstrap-windows.ps1" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
