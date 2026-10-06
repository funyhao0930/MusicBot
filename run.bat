@ECHO off

CHCP 65001 > NUL
CD /d "%~dp0"

SETLOCAL ENABLEEXTENSIONS
SET KEY_NAME="HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced"
SET VALUE_NAME=HideFileExt

FOR /F "usebackq tokens=1-3" %%A IN (`REG QUERY %KEY_NAME% /v %VALUE_NAME% 2^>nul`) DO (
    SET ValueName=%%A
    SET ValueType=%%B
    SET ValueValue=%%C
)

REM 0x0 means Explorer already shows file extensions.
IF NOT "%ValueValue%"=="0x0" (
    ECHO Unhiding file extensions...
    REG ADD %KEY_NAME% /v %VALUE_NAME% /t REG_DWORD /d 0 /f > NUL
)
ENDLOCAL


IF NOT EXIST %SYSTEMROOT%\py.exe GOTO findpython
CMD /c %SYSTEMROOT%\py.exe -3 run.py %*
GOTO finished

:findpython
python --version > NUL 2>&1
IF %ERRORLEVEL% NEQ 0 GOTO nopython

CMD /c python run.py %*

:finished
REM Close with MusicBot, but keep a crash on screen long enough to read it.
IF %ERRORLEVEL% NEQ 0 PAUSE
EXIT

:nopython
ECHO ERROR: Python has either not been installed or not added to your PATH.

:end
PAUSE
