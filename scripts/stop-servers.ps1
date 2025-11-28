# Stop all Node.js processes running on ports 3000 and 3001
Write-Host "Stopping servers on ports 3000 and 3001..." -ForegroundColor Yellow

# Get processes using ports 3000 and 3001
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
$port3001 = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

$processesToKill = @()
if ($port3000) { $processesToKill += $port3000 }
if ($port3001) { $processesToKill += $port3001 }

if ($processesToKill.Count -gt 0) {
    foreach ($pid in $processesToKill) {
        try {
            $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "Stopping process $pid ($($proc.ProcessName))..." -ForegroundColor Yellow
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            }
        } catch {
            Write-Host "Could not stop process $pid: $_" -ForegroundColor Red
        }
    }
    Start-Sleep -Seconds 2
    Write-Host "Servers stopped." -ForegroundColor Green
} else {
    Write-Host "No servers found running on ports 3000 or 3001." -ForegroundColor Green
}





