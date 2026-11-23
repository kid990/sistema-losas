@echo off
rem Prediccion diaria RF-04: 14 dias habiles desde hoy.
cd /d "%~dp0.."
"%~dp0.venv\Scripts\python.exe" -m ml.predict_ocupacion --dias 14
