@echo off
set "NODE_DIR=C:\Users\nfonc\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.16.0-win-x64"
set "PATH=%NODE_DIR%;%PATH%"
cd /d "C:\Users\nfonc\OneDrive\Desktop\Kin 1"
"%NODE_DIR%\node.exe" "node_modules\next\dist\bin\next" dev
