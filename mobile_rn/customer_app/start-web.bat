@echo off
rem Aperçu web de l'app client (Expo) pour vérifier les écrans dans un navigateur.
cd /d "%~dp0"
set CI=1
set BROWSER=none
npx expo start --web --port 8095
