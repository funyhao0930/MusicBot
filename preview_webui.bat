@ECHO off
CHCP 65001 > NUL
CD /d "%~dp0"

REM Double-click defaults to the preview port; explicit arguments still win.
IF "%~1"=="" (
    SET "PREVIEW_ARGS=--port 8877"
) ELSE (
    SET "PREVIEW_ARGS=%*"
)

WHERE py > NUL 2>&1
IF %ERRORLEVEL% EQU 0 (
    py -3 preview_webui.py %PREVIEW_ARGS%
) ELSE (
    python preview_webui.py %PREVIEW_ARGS%
)

IF %ERRORLEVEL% NEQ 0 PAUSE
