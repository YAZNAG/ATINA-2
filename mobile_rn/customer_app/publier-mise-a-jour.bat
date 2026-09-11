@echo off
rem Publie le code actuel de l'app comme mise a jour a distance pour les APK "preview".
rem Les telephones la recoivent au prochain lancement (ecran "Mise a jour disponible").
rem A utiliser pour tout changement JavaScript (ecrans, textes, logique, images).
rem Un nouvel APK n'est necessaire que si on ajoute un module natif ou si on change "version" dans app.json.
cd /d "%~dp0"
set /p MSG=Description de la mise a jour : 
call npx eas-cli update --channel preview --environment preview --message "%MSG%"
pause
