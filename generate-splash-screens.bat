@echo off
echo Generazione splash screen per iOS...

REM Verifica se Inkscape è installato
where inkscape >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Inkscape non trovato. Installa Inkscape per generare le splash screen.
    echo Puoi scaricarlo da: https://inkscape.org/release/
    exit /b 1
)

REM Genera le diverse dimensioni di splash screen
inkscape --export-filename=splash-640x1136.png --export-width=640 --export-height=1136 splash-base.svg
inkscape --export-filename=splash-750x1334.png --export-width=750 --export-height=1334 splash-base.svg
inkscape --export-filename=splash-1242x2208.png --export-width=1242 --export-height=2208 splash-base.svg
inkscape --export-filename=splash-1125x2436.png --export-width=1125 --export-height=2436 splash-base.svg
inkscape --export-filename=splash-1536x2048.png --export-width=1536 --export-height=2048 splash-base.svg
inkscape --export-filename=splash-1668x2224.png --export-width=1668 --export-height=2224 splash-base.svg
inkscape --export-filename=splash-2048x2732.png --export-width=2048 --export-height=2732 splash-base.svg

echo Generazione completata!