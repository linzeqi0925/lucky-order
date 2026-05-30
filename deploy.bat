@echo off
setlocal enabledelayedexpansion
echo luckyorder@luckyck.cn > "%TEMP%\surge_input.txt"
echo LuckyOrder2026! >> "%TEMP%\surge_input.txt"
echo luckyck26.surge.sh >> "%TEMP%\surge_input.txt"
type "%TEMP%\surge_input.txt" | npx surge ./dist
del "%TEMP%\surge_input.txt"
pause