$ErrorActionPreference = 'Stop'
$zuvoriRoot = $PSScriptRoot
$zuvoriNodeCommand = Get-Command node -ErrorAction SilentlyContinue
$zuvoriNode = if ($zuvoriNodeCommand) { $zuvoriNodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' }
if (-not (Test-Path -LiteralPath $zuvoriNode)) { throw 'Instale Node.js 22 ou mais recente para iniciar o Zuvori.' }
Write-Host 'Abra http://127.0.0.1:4173 no navegador. Use Ctrl+C para encerrar.'
& $zuvoriNode (Join-Path $zuvoriRoot 'scripts/serve.mjs')
