# Servidor estático solo frontend (puerto 8080)
Set-Location "$PSScriptRoot\..\frontend"
Write-Host "TPPMAPS frontend: http://localhost:8080/index.html"
python -m http.server 8080
