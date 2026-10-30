$env:JAVA_HOME = "C:\Users\shaik\AppData\Local\Android\jdk17\jdk-17.0.20.1+1"
$env:ANDROID_HOME = "C:\Users\shaik\AppData\Local\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path

Write-Host "Building web frontend with Live Backend URL..."
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Syncing Capacitor..."
npx cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Building Android Release APK..."
cd android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

.\gradlew.bat assembleRelease
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "APK built successfully!"
