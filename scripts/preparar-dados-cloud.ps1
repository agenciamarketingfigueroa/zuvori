param(
  [Parameter(Mandatory = $true)][string]$Cliente,
  [string]$Backup
)
$ErrorActionPreference = 'Stop'
$zuvoriNodeCommand = Get-Command node -ErrorAction SilentlyContinue
$zuvoriNode = if ($zuvoriNodeCommand) { $zuvoriNodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' }
if (-not (Test-Path -LiteralPath $zuvoriNode)) { throw 'Node.js 22 ou mais recente não foi encontrado.' }
$argsForNode = @((Join-Path $PSScriptRoot 'prepare-cloud-data.mjs'), $Cliente)
if ($Backup) { $argsForNode += $Backup }
& $zuvoriNode @argsForNode
