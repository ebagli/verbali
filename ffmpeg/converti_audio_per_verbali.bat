@echo off
color 0B
echo ===================================================
echo     OTTIMIZZATORE E SPLITTER AUDIO PER AI
echo ===================================================
echo.

REM 1. Crea le cartelle se non esistono
if not exist "input" (
    mkdir "input"
    echo [INFO] Creata cartella "input".
)
if not exist "output" (
    mkdir "output"
    echo [INFO] Creata cartella "output".
)

REM Controlla se ci sono file nella cartella input
set fileTrovati=0
for %%F in ("input\*.*") do set /a fileTrovati+=1

if %fileTrovati%==0 (
    echo [ATTENZIONE] Nessun file trovato nella cartella "input".
    echo Metti i tuoi file MP3, WAV o M4A nella cartella "input" e riavvia lo script.
    echo.
    pause
    exit
)

echo Trovati %fileTrovati% file da processare. Inizio conversione e divisione...
echo.

REM 2. Cicla su tutti i file presenti nella cartella input
for %%F in ("input\*.mp3" "input\*.wav" "input\*.m4a" "input\*.ogg" "input\*.mp4") do (
    
    echo [IN ELABORAZIONE] "%%~nxF" ...
    echo Sto comprimendo e dividendo in blocchi da 15 minuti...
    
    REM Esecuzione di FFmpeg:
    REM -y : sovrascrive senza chiedere
    REM -f segment -segment_time 900 : divide il file ogni 15 min
    REM %%03d assicura che i file si chiamino parte_000, parte_001, ecc.
    
    "ffmpeg.exe" -y -i "%%F" -f segment -segment_time 900 -ar 16000 -ac 1 -ab 32k "output\%%~nF_parte_%%03d.mp3" -loglevel error
    
    echo [FATTO] File diviso e salvato nella cartella output
    echo ---------------------------------------------------
)

echo.
echo ===================================================
echo PROCESSO COMPLETATO!
echo Tutti i file sono pronti nella cartella "output".
echo ===================================================
echo.
pause