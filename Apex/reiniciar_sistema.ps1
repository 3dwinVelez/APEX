# reiniciar_sistema.ps1
Write-Host "🔄 REINICIANDO SISTEMA APEX" -ForegroundColor Cyan

# Paso 1: Matar procesos
Write-Host "📌 Cerrando aplicaciones..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*python*"} | Stop-Process -Force 2>$null
Start-Sleep -Seconds 2

# Paso 2: Eliminar base
$dbPath = "G:\Mi unidad\Proyectos\scj\data\apex.db"
if (Test-Path $dbPath) {
    Remove-Item $dbPath -Force
    Write-Host "✅ Base eliminada" -ForegroundColor Green
} else {
    Write-Host "📂 Base no existe" -ForegroundColor Yellow
}

# Paso 3: Poblar
Write-Host "🚀 Poblando base con datos MEDIO..." -ForegroundColor Cyan
python tests/seed_db.py

Write-Host "`n✨ ¡Listo! Ya puedes ejecutar la aplicación: python main.py" -ForegroundColor Green