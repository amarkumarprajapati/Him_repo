[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

if ($PSVersionTable.PSVersion.Major -ge 6 -and -not $IsWindows) {
    Write-Host "This script is intended to run on Windows only." -ForegroundColor Red
    exit 1
}
if ($env:OS -ne "Windows_NT") {
    Write-Host "This script is intended to run on Windows only." -ForegroundColor Red
    exit 1
}

$PORT = if ($env:PORT) { $env:PORT } else { "8000" }

function Resolve-Python {
    if ($env:PYTHON_BIN) {
        return $env:PYTHON_BIN
    }

    foreach ($candidate in @("py", "python", "python3")) {
        if (Get-Command $candidate -ErrorAction SilentlyContinue) {
            return $candidate
        }
    }

    return $null
}

$PYTHON_BIN = Resolve-Python

function Write-Section($Message) { Write-Host $Message -ForegroundColor Green }
function Write-Ok($Message) { Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Info($Message) { Write-Host "[INFO] $Message" -ForegroundColor Yellow }
function Write-Err($Message) { Write-Host "[ERR] $Message" -ForegroundColor Red }

function Set-ProcessEnvValue($Name, $Value) {
    [Environment]::SetEnvironmentVariable($Name, $Value, "Process")
}

function Import-DotEnv($Path) {
    foreach ($rawLine in Get-Content $Path) {
        $line = $rawLine.Trim()
        if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
            continue
        }

        $parts = $line.Split("=", 2)
        Set-ProcessEnvValue $parts[0].Trim() $parts[1].Trim()
    }
}

function Invoke-Checked($Command, $Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $Command $($Arguments -join ' ')"
    }
}

function Test-VenvHealthy($PythonPath, $ExpectedVersionPrefix) {
    if (-not (Test-Path $PythonPath)) {
        return $false
    }

    try {
        $reportedVersion = & $PythonPath -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $reportedVersion) {
            return $false
        }

        return $reportedVersion.Trim().StartsWith($ExpectedVersionPrefix)
    } catch {
        return $false
    }
}

function Replace-OrAppendEnvValue($Path, $Key, $Value) {
    $content = Get-Content $Path -Raw
    $pattern = "(?m)^" + [regex]::Escape($Key) + "=.*$"
    $replacement = "$Key=$Value"

    if ($content -match $pattern) {
        $updated = [regex]::Replace($content, $pattern, $replacement)
    } else {
        $separator = if ($content.EndsWith("`r`n") -or $content.EndsWith("`n")) { "" } else { [Environment]::NewLine }
        $updated = $content + $separator + $replacement + [Environment]::NewLine
    }

    Set-Content -Path $Path -Value $updated
}

Write-Section "========================================"
Write-Section "      Himshravan V1 EWCPS API           "
Write-Section "========================================"

if (-not $PYTHON_BIN) {
    Write-Err "Python 3.10+ is required but was not found."
    Write-Err "Install Python from https://www.python.org/downloads/windows/ and ensure it is on PATH."
    exit 1
}

try {
    $pythonVersion = & $PYTHON_BIN --version 2>&1
    Write-Ok "Python found: $pythonVersion"
} catch {
    Write-Err "Unable to run Python via '$PYTHON_BIN'."
    exit 1
}

if (-not (Test-Path ".env")) {
    if (-not (Test-Path ".env.example")) {
        Write-Err ".env.example not found. Cannot create .env automatically."
        exit 1
    }

    Write-Info ".env not found. Creating from .env.example..."
    Copy-Item ".env.example" ".env"

    $secretKey = & $PYTHON_BIN -c "import secrets; print(secrets.token_urlsafe(50))"
    Replace-OrAppendEnvValue ".env" "SECRET_KEY" $secretKey

    $envMap = @{}
    foreach ($line in Get-Content ".env") {
        if ($line -match '^\s*([^#=\s]+)\s*=(.*)$') {
            $envMap[$matches[1]] = $matches[2]
        }
    }

    if ($envMap.ContainsKey("DB_PASSWORD") -and $envMap["DB_PASSWORD"] -eq "change-this-password") {
        $dbPassword = "himshravan@123456"
        Replace-OrAppendEnvValue ".env" "DB_PASSWORD" $dbPassword
        Write-Info "DB_PASSWORD set to default: $dbPassword"
    }

    Write-Ok ".env created with random SECRET_KEY"
} else {
    Write-Ok ".env already exists"
}

Import-DotEnv ".env"
$PORT = if ($env:PORT) { $env:PORT } else { $PORT }
Set-ProcessEnvValue "SSL_CERT_FILE" $null

if (Get-Command "psql" -ErrorAction SilentlyContinue) {
    $dbPassword = $env:DB_PASSWORD
    if ($dbPassword) {
        Write-Info "Ensuring PostgreSQL password for 'postgres' user..."
        try {
            $env:PGPASSWORD = $dbPassword
            & psql -U postgres -d postgres -c "ALTER USER postgres WITH PASSWORD '$dbPassword';" *> $null
            Write-Ok "PostgreSQL password updated"
        } catch {
            Write-Info "Skipping PostgreSQL password update on this machine."
        } finally {
            Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
        }
    }
}

$venvDir = Join-Path (Get-Location) ".venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"
$venvPip = Join-Path $venvDir "Scripts\pip.exe"

$needsVenvRebuild = (-not (Test-Path $venvPip)) -or (-not (Test-VenvHealthy $venvPython "3.10"))

if ($needsVenvRebuild) {
    if (Test-Path $venvDir) {
        Write-Info "Existing .venv is missing or tied to another Python version. Recreating..."
        Remove-Item -Recurse -Force $venvDir
    }

    Write-Info "Creating virtual environment..."
    Invoke-Checked $PYTHON_BIN @("-m", "venv", ".venv")
}

if ((-not (Test-Path $venvPip)) -or (-not (Test-VenvHealthy $venvPython "3.10"))) {
    Write-Err "Virtual environment setup failed."
    exit 1
}

Write-Info "Installing/Updating dependencies..."
Invoke-Checked $venvPython @("-m", "pip", "install", "--upgrade", "pip")
try {
    Invoke-Checked $venvPip @("install", "-r", "requirements.txt")
} catch {
    Write-Err "Failed to install dependencies."
    Write-Info "Hint: if psycopg2 fails, install PostgreSQL build tools or switch DATABASE_ENGINE=sqlite in .env for local development."
    exit 1
}

Write-Info "Checking port $PORT..."
try {
    $connections = Get-NetTCPConnection -LocalPort $PORT -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($processId in $processIds) {
            if ($processId -and $processId -ne 0) {
                Write-Info "Port $PORT in use. Stopping PID $processId..."
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            }
        }
        Start-Sleep -Seconds 1
    }
} catch {
    Write-Info "Skipping port check on this Windows version."
}

foreach ($dir in @("logs", "cache")) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
    }
}

Write-Info "Creating any missing migrations..."
try {
    & $venvPython manage.py makemigrations authentication device telemetry events notifications --noinput 2>$null
} catch {
}

Write-Info "Applying migrations..."
Invoke-Checked $venvPython @("manage.py", "migrate", "--noinput")

$superUser = if ($env:DJANGO_SUPERUSER_USERNAME) { $env:DJANGO_SUPERUSER_USERNAME } else { "admin" }
$superPass = if ($env:DJANGO_SUPERUSER_PASSWORD) { $env:DJANGO_SUPERUSER_PASSWORD } else { "Admin@123" }
$superEmail = if ($env:DJANGO_SUPERUSER_EMAIL) { $env:DJANGO_SUPERUSER_EMAIL } else { "admin@example.com" }

Write-Info "Ensuring Django superuser '$superUser' exists..."
$env:SU_USER = $superUser
$env:SU_PASS = $superPass
$env:SU_EMAIL = $superEmail
$superUserScript = @"
import os
from authentication.models import User

username = os.environ["SU_USER"]
email = os.environ["SU_EMAIL"]
password = os.environ["SU_PASS"]
obj = User.objects.filter(username=username).first()
if obj is None:
    User.objects.create_superuser(username=username, email=email, password=password, role="SUPER_ADMIN")
    print("Superuser created")
else:
    obj.email = email
    obj.is_staff = True
    obj.is_superuser = True
    if hasattr(obj, "role"):
        obj.role = "SUPER_ADMIN"
    obj.set_password(password)
    obj.save()
    print("Superuser updated")
"@
try {
    Invoke-Checked $venvPython @("manage.py", "shell", "-c", $superUserScript)
    Write-Ok "Superuser ready: $superUser"
} catch {
    Write-Err "Superuser creation failed (check authentication app is migrated)."
}
Remove-Item Env:SU_USER -ErrorAction SilentlyContinue
Remove-Item Env:SU_PASS -ErrorAction SilentlyContinue
Remove-Item Env:SU_EMAIL -ErrorAction SilentlyContinue

Write-Info "Collecting static files..."
Invoke-Checked $venvPython @("manage.py", "collectstatic", "--noinput", "--clear")

Write-Ok "Bootstrap complete. Starting server..."
Write-Section "----------------------------------------"
Write-Host "  Server Details:" -ForegroundColor Cyan
Write-Host "  - URL:  http://localhost:$PORT/"
Write-Host "  - Docs: http://localhost:$PORT/api/docs/"
Write-Host "  - API:  http://localhost:$PORT/api/"
Write-Section "----------------------------------------"
Write-Host ""

Invoke-Checked $venvPython @("manage.py", "runserver", "0.0.0.0:$PORT")
