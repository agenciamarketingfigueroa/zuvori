param([Parameter(Mandatory = $true)][string]$Cliente)
$ErrorActionPreference = 'Stop'
$zuvoriNodeCommand = Get-Command node -ErrorAction SilentlyContinue
$zuvoriNode = if ($zuvoriNodeCommand) { $zuvoriNodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' }
if (-not (Test-Path -LiteralPath $zuvoriNode)) { throw 'Node.js 22 ou mais recente não foi encontrado.' }
$username = Read-Host 'Usuário para entrar na Zuvori'
$first = Read-Host 'Nova senha forte (mínimo de 16 caracteres)' -AsSecureString
$second = Read-Host 'Repita a nova senha' -AsSecureString
$firstPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($first)
$secondPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)
try {
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($firstPointer)
  $confirmation = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secondPointer)
  if ($password -cne $confirmation) { throw 'As senhas digitadas não coincidem. Execute a tarefa novamente.' }
  if ($password.Length -lt 16) { throw 'Use uma senha nova com pelo menos 16 caracteres.' }
  $OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
  $payload = @{ username = $username; password = $password } | ConvertTo-Json -Compress
  $payload | & $zuvoriNode (Join-Path $PSScriptRoot 'setup-cloud-auth.mjs') $Cliente --stdin-json
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível preparar o login. Leia a mensagem acima e tente novamente.' }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($firstPointer)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secondPointer)
  Remove-Variable password,confirmation,payload -ErrorAction SilentlyContinue
}
