# One-time setup for the nightly TGD WMS Supabase backup.
#
#   powershell -ExecutionPolicy Bypass -File scripts\backup\install-backup.ps1
#
# Run it in a normal (interactive) PowerShell window. It will:
#   1. create C:\TGD-Backups (config, tools, bin, daily) outside OneDrive
#   2. download PostgreSQL 17 client tools (pg_dump / pg_restore / psql)
#   3. copy the backup scripts to C:\TGD-Backups\bin
#   4. create config\backup.env from the example if it does not exist yet
#   5. restrict the folder to you, Administrators and SYSTEM (backups are not encrypted)
#   6. register the "TGD WMS Backup" scheduled task (daily 02:00, runs even when
#      you are logged off; no Windows password needed)
param(
  [string]$Root = 'C:\TGD-Backups',
  [string]$PgVersion = '17.6-1',
  [string]$RunAt = '02:00',
  [switch]$SkipTask
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "== TGD WMS backup setup -> $Root"
foreach ($dir in @($Root, "$Root\config", "$Root\tools", "$Root\bin", "$Root\daily")) {
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
}

# 2. PostgreSQL client tools (zip binaries, no service installed)
$pgDump = "$Root\tools\pgsql\bin\pg_dump.exe"
if (-not (Test-Path $pgDump)) {
  $zipUrl = "https://get.enterprisedb.com/postgresql/postgresql-$PgVersion-windows-x64-binaries.zip"
  $zipPath = "$Root\tools\pgsql-$PgVersion.zip"
  Write-Host "Downloading PostgreSQL $PgVersion client tools..."
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
  Expand-Archive -Path $zipPath -DestinationPath "$Root\tools" -Force
  Remove-Item $zipPath -Force
}
& $pgDump --version

# 3. scripts
foreach ($file in @('backupLib.mjs', 'run-backup.mjs', 'restore-test.mjs')) {
  Copy-Item -Path (Join-Path $here $file) -Destination "$Root\bin\$file" -Force
}
Write-Host "Scripts copied to $Root\bin"

# 4. config
$envFile = "$Root\config\backup.env"
if (-not (Test-Path $envFile)) {
  Copy-Item -Path (Join-Path $here 'backup.env.example') -Destination $envFile
  Write-Host "Created $envFile -- open it and fill in the DB password before the first run." -ForegroundColor Yellow
}

# 5. permissions: only this user, Administrators and SYSTEM
$me = "$env:USERDOMAIN\$env:USERNAME"
icacls $Root /inheritance:r /grant:r "${me}:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-18:(OI)(CI)F" | Out-Null
Write-Host "Folder access limited to $me, Administrators, SYSTEM"

# 6. scheduled task
if (-not $SkipTask) {
  $node = (Get-Command node -ErrorAction Stop).Source
  $action = New-ScheduledTaskAction -Execute $node -Argument "`"$Root\bin\run-backup.mjs`" --root `"$Root`"" -WorkingDirectory "$Root\bin"
  $trigger = New-ScheduledTaskTrigger -Daily -At $RunAt
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1) -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 15)
  # S4U: runs whether or not the user is logged on, without storing a
  # Windows password (works for PIN / passwordless accounts too). It has no
  # saved network credentials, so an EXTRA_COPY_DIR on a NAS share needs
  # that share to allow this machine's account; local folders are fine.
  # Registering an S4U task needs an elevated (Run as Administrator) shell.
  # Without it, fall back to Interactive: the task still runs every night,
  # but only while this user is logged on. Re-run elevated to upgrade.
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  $logonType = if ($isAdmin) { 'S4U' } else { 'Interactive' }
  $principal = New-ScheduledTaskPrincipal -UserId $me -LogonType $logonType -RunLevel Limited
  Register-ScheduledTask -TaskName 'TGD WMS Backup' -Action $action -Trigger $trigger -Settings $settings `
    -Principal $principal -Force | Out-Null
  Write-Host "Scheduled task 'TGD WMS Backup' registered: daily at $RunAt ($logonType)"
  if (-not $isAdmin) {
    Write-Host 'Note: runs only while you are logged on. Re-run this script in PowerShell "Run as Administrator" to make it run when logged off too.' -ForegroundColor Yellow
  }
}

Write-Host ''
Write-Host 'Next: fill in config\backup.env, then test with:' -ForegroundColor Green
Write-Host "  node `"$Root\bin\run-backup.mjs`" --root `"$Root`""
