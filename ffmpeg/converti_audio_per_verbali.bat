@echo off
color 0B
echo ===================================================
echo     OTTIMIZZATORE AUDIO PER VERBALI AI (GEMINI)
echo ===================================================
echo.

:: 1. Crea le cartelle se non esistono
if not exist "input" (
    mkdir "input"
    echo [INFO] Creata cartella "input". Inserisci qui i tuoi file originali.
)
if not exist "output" (
    mkdir "output"
    echo [INFO] Creata cartella "output".
)

:: Controlla se ci sono file nella cartella input
set fileTrovati=0
for %%F in ("input\*.*") do set /a fileTrovati+=1

if %fileTrovati%==0 (
    echo [ATTENZIONE] Nessun file trovato nella cartella "input".
    echo Metti i tuoi file MP3, WAV o M4A nella cartella "input" e riavvia lo script.
    echo.
    pause
    exit
)

echo Trovati %fileTrovati% file da processare. Inizio conversione...
echo.

:: 2. Cicla su tutti i file presenti nella cartella input
:: Elabora i formati audio/video piu comuni
for %%F in ("input\*.mp3" "input\*.wav" "input\*.m4a" "input\*.ogg" "input\*.mp4") do (
    
    echo [IN ELABORAZIONE] "%%~nxF" ...
    
    :: Esecuzione di FFmpeg:
    :: -y sovrascrive senza chiedere
    :: -ar 16000 -ac 1 -ab 32k comprime in formato "voce leggera"
    "ffmpeg.exe" -y -i "%%F" -ar 16000 -ac 1 -ab 32k "output\%%~nF.mp3" -loglevel error
    
    echo [FATTO] Salvato in output\%%~nF.mp3
    echo ---------------------------------------------------
)

echo.
echo ===================================================
echo PROCESSO COMPLETATO!
echo Tutti i file sono pronti nella cartella "output".
echo Ora puoi caricarli nella tua applicazione (Max 25MB).
echo ===================================================
echo.
pause