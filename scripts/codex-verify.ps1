$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

$steps = @(
  @{ Name = 'typecheck'; Args = @('run', 'typecheck') },
  @{ Name = 'lint'; Args = @('run', 'lint') },
  @{ Name = 'test'; Args = @('test') },
  @{ Name = 'build'; Args = @('run', 'build') }
)

foreach ($step in $steps) {
  Write-Host "== $($step.Name)"
  & npm.cmd @($step.Args)
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host 'All checks passed.'
