# Run a pipeline script in headless Blender.
#   .\blender\run.ps1 01_bust.py [-Blend path\to\file.blend] [-ScriptArgs a,b]
param(
    [Parameter(Mandatory = $true)][string]$Script,
    [string]$Blend = '',
    [string[]]$ScriptArgs = @()
)
$bl = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$argv = @('--background', '--factory-startup')
if ($Blend) { $argv += $Blend }
$argv += @('--python-exit-code', '1', '--python', (Join-Path $here "scripts\$Script"), '--') + $ScriptArgs
$log = & $bl @argv 2>&1 | Out-String
$code = $LASTEXITCODE
$log | Out-File -Encoding utf8 (Join-Path $here 'previews\last_run.log')
$log -split "`r?`n" | Where-Object { $_ -like '@@JSON@@*' } | ForEach-Object { $_.Substring(8) }
if ($code -ne 0) {
    "EXIT $code"
    ($log -split "`r?`n" | Select-Object -Last 40) -join "`n"
}
