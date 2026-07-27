# HIMSHRAVAN Desktop App — Build Guide

Step-by-step guide to rebuild the Windows desktop client with your server IP.

---

## Prerequisites

- **Python 3.10 or 3.11** must be installed on your Windows PC.
  - Download from: https://www.python.org/downloads/
  - During installation, check **"Add Python to PATH"**.
- The build script will **not work** with Python 3.12, 3.13, 3.14, etc.

---

## Step 1 — Verify Python Installation

The build script requires Python 3.10 or 3.11 specifically. Your system may have a newer Python as the default. Check what you have:

### Command

```powershell
python --version
```

### Expected Output (if default is newer)

```
Python 3.14.6
```

This means the default `python` is too new. Check if `py` launcher finds 3.10:

```powershell
py -3.10 --version
```

### Expected Output

```
Python 3.10.11
```

This confirms Python 3.10 is installed and accessible via the `py` launcher.

---

## Step 2 — Set Server IP in build.env

Open `E:\Downloads\Desktop_app\Desktop_app\build.env` and set your server IP:

### File Content

```env
# Domain URL
APP_URL_DOMAIN=http://himshraven-c2.in:3001

# Provide the Ubuntu Local System IP here if known
APP_URL_IP=10.164.22.62

# Optional hard-coded Ubuntu LAN IP
APP_URL_FALLBACK_IP=10.164.22.62

APP_PORT=3001

# The startup dialog will automatically show both the domain and the IP options.
PROMPT_FOR_URL=1

VERSION=1.0.0
```

### What Changed

| Setting | Old Value | New Value |
|---------|-----------|-----------|
| `APP_URL_IP` | `192.78.10.34` | `10.164.22.62` |
| `APP_URL_FALLBACK_IP` | `192.78.10.34` | `10.164.22.62` |

---

## Step 3 — Create Python Virtual Environment

Navigate to the project directory and create an isolated Python 3.10 virtual environment for the build:

### Command

```powershell
cd E:\Downloads\Desktop_app\Desktop_app
py -3.10 -m venv build\windows-build-venv
```

### Expected Output

No output means success. A `build\windows-build-venv\` folder is created.

---

## Step 4 — Upgrade pip and Install Wheel

### Command

```powershell
& "build\windows-build-venv\Scripts\python.exe" -m pip install --upgrade pip wheel
```

### Expected Output

```
Requirement already satisfied: pip in e:\downloads\desktop_app\desktop_app\build\windows-build-venv\lib\site-packages (23.0.1)
Collecting pip
  Using cached pip-26.1.2-py3-none-any.whl (1.8 MB)
Collecting wheel
  Downloading wheel-0.47.0-py3-none-any.whl (32 kB)
Collecting packaging>=24.0
  Downloading packaging-26.2-py3-none-any.whl (100 kB)
Installing collected packages: pip, packaging, wheel
  Attempting uninstall: pip
    Found existing installation: pip 23.0.1
    Uninstalling pip-23.0.1:
      Successfully uninstalled pip-23.0.1
Successfully installed packaging-26.2 pip-26.1.2 wheel-0.47.0
```

---

## Step 5 — Install Desktop Dependencies (PyQt6)

### Command

```powershell
& "build\windows-build-venv\Scripts\python.exe" -m pip install -r requirements-desktop.txt
```

### Expected Output

```
Collecting PyQt6==6.11.0 (from -r requirements-desktop.txt (line 1))
  Downloading pyqt6-6.11.0-cp310-abi3-win_amd64.whl.metadata (2.2 kB)
Collecting PyQt6-WebEngine>=6.11.0 (from -r requirements-desktop.txt (line 2))
  Downloading pyqt6_webengine-6.11.0-cp310-abi3-win_amd64.whl.metadata (1.9 kB)
Collecting PyQt6-sip<14,>=13.8 (from PyQt6==6.11.0->-r requirements-desktop.txt (line 1))
  Downloading pyqt6_sip-13.11.1-cp310-cp310-win_amd64.whl.metadata (516 bytes)
Collecting PyQt6-Qt6<6.12.0,>=6.11.0 (from PyQt6==6.11.0->-r requirements-desktop.txt (line 1))
  Downloading pyqt6_qt6-6.11.1-py3-none-win_amd64.whl.metadata (552 bytes)
Collecting PyQt6-WebEngine-Qt6<6.12.0,>=6.11.0 (from PyQt6-WebEngine>=6.11.0->-r requirements-desktop.txt (line 2))
  Downloading pyqt6_webengine_qt6-6.11.1-py3-none-win_amd64.whl.metadata (592 bytes)
Downloading pyqt6-6.11.0-cp310-abi3-win_amd64.whl (6.8 MB)
Downloading pyqt6_qt6-6.11.1-py3-none-win_amd64.whl (78.4 MB)
Downloading pyqt6_sip-13.11.1-cp310-cp310-win_amd64.whl (54 kB)
Downloading pyqt6_webengine-6.11.0-cp310-abi3-win_amd64.whl (257 kB)
Downloading pyqt6_webengine_qt6-6.11.1-py3-none-win_amd64.whl (132.9 MB)
Installing collected packages: PyQt6-WebEngine-Qt6, PyQt6-Qt6, PyQt6-sip, PyQt6, PyQt6-WebEngine
Successfully installed PyQt6-6.11.0 PyQt6-Qt6-6.11.1 PyQt6-WebEngine-6.11.0 PyQt6-WebEngine-Qt6-6.11.1 PyQt6-sip-13.11.1
```

---

## Step 6 — Install PyInstaller

### Command

```powershell
& "build\windows-build-venv\Scripts\python.exe" -m pip install pyinstaller
```

### Expected Output

```
Collecting pyinstaller
  Downloading pyinstaller-6.21.0-py3-none-win_amd64.whl.metadata (8.5 kB)
Collecting altgraph (from pyinstaller)
  Downloading altgraph-0.17.5-py2.7-none-any.whl.metadata (1.4 kB)
Collecting pefile>=2022.5.30 (from pyinstaller)
  Downloading pefile-2024.8.26-py3-none-any.whl.metadata (1.4 kB)
Collecting pyinstaller-hooks-contrib>=2026.6 (from pyinstaller)
  Downloading pyinstaller_hooks_contrib-2026.6-py3-none-any.whl.metadata (16 kB)
Collecting pywin32-ctypes>=0.2.1 (from pyinstaller)
  Downloading pywin32_ctypes-0.2.3-py3-none-any.whl.metadata (3.9 kB)
Installing collected packages: altgraph, pywin32-ctypes, pyinstaller-hooks-contrib, pefile, pyinstaller
Successfully installed altgraph-0.17.5 pywin32-ctypes-0.2.3 pyinstaller-hooks-contrib-2026.6 pefile-2024.8.26 pyinstaller-6.21.0
```

---

## Step 7 — Build the Executable with PyInstaller

### Command

```powershell
& "build\windows-build-venv\Scripts\pyinstaller.exe" `
  --noconfirm `
  --clean `
  --onefile `
  --windowed `
  --name himshravan `
  --distpath dist `
  --workpath build\pyinstaller-work `
  --specpath build `
  --paths . `
  --add-data "desktop\assets;desktop/assets" `
  --add-data "desktop\qwebchannel.js;desktop" `
  --collect-all PyQt6 `
  --collect-all PyQt6.QtWebEngineCore `
  --collect-all PyQt6.QtWebEngineWidgets `
  --hidden-import PyQt6.sip `
  desktop\__main__.py
```

### Expected Output (key lines)

```
INFO: PyInstaller: 6.21.0, contrib hooks: 2026.6
INFO: Python: 3.10.11
INFO: Platform: Windows-10-10.0.26200-SP0
INFO: Python environment: build\windows-build-venv
INFO: wrote build\himshravan.spec
INFO: Appending PKG archive to EXE
INFO: Fixing EXE headers
INFO: Build complete! The results are available in: dist
```

### Expected Warnings (safe to ignore)

```
WARNING: Library not found: could not resolve 'Qt63DCore.dll', ...
WARNING: Library not found: could not resolve 'Qt63DRender.dll', ...
WARNING: Library not found: could not resolve 'Qt6QmlCompiler.dll', ...
```

These are optional Qt modules not needed by the app. The build still succeeds.

---

## Step 8 — Verify the Executable

### Command

```powershell
Get-Item dist\himshravan.exe | Select-Object Name, Length, LastWriteTime
```

### Expected Output

```
Name              Length       LastWriteTime
----              ------       -------------
himshravan.exe    223501425    7/17/2026 3:21:54 PM
```

The `.exe` should be approximately **223 MB**.

---



## Step 9 — Run the App

### Command

```powershell
dist\himshravan.exe
```

Or double-click `himshravan.exe` in File Explorer.

### Expected Behavior

1. A **URL picker dialog** appears showing server options (IP and/or domain).
2. Select your server URL: **http://10.164.22.62:3001**
3. Click **OK**.
4. The HIMSHRAVAN website loads in a native desktop window.

---

## Output Files Summary

| File | Path | Size |
|------|------|------|
| Executable | `dist\himshravan.exe` | ~223 MB |
| Release folder | `release\himshravan-desktop-app_1.0.0_win64_<timestamp>\` | Contains exe + config |
| Release ZIP | `release\himshravan-desktop-app_1.0.0_win64_<timestamp>.zip` | Ready to deploy |

---

## To Change Server IP Later (No Rebuild)

Edit `app.env` in the same folder as `himshravan.exe`:

```env
APP_URL=http://YOUR.NEW.IP:3001
```

Save and restart the app.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Python 3.14 is not supported` | Install Python 3.10 or 3.11. The build script rejects other versions. |
| `No suitable Python runtime found` | Use `py -3.10` instead of `python`. The `py` launcher finds installed versions. |
| Windows SmartScreen blocks the exe | Click **More info** → **Run anyway**. The app is not code-signed. |
| App shows blank screen | Check that the server at the configured IP:port is running and reachable. |
| Build script exits with no output | Run commands manually step-by-step (Steps 3–7) to isolate the error. |
