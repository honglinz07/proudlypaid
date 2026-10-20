param([switch]$RetryFailed)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$checkpointPath = Join-Path $projectRoot ".local\github-collection\run.json"
$secureToken = $null
$tokenPointer = [IntPtr]::Zero

Push-Location $projectRoot
try {
  $secureToken = Read-Host "Paste the fine-grained GitHub token (input is hidden)" -AsSecureString
  $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
  $env:GH_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)

  while ($true) {
    if ($RetryFailed) {
      npm run github:collect -- --retry-failed
      $RetryFailed = $false
    }
    else {
      npm run github:collect
    }
    $collectorExitCode = $LASTEXITCODE
    if ($collectorExitCode -ne 0 -and $collectorExitCode -ne 2) {
      throw "The collector exited with code $collectorExitCode."
    }

    if (-not (Test-Path -LiteralPath $checkpointPath)) {
      throw "The collector checkpoint was not found at $checkpointPath."
    }
    $checkpoint = Get-Content -LiteralPath $checkpointPath -Raw | ConvertFrom-Json
    if ($checkpoint.status -eq "complete" -or
        ($checkpoint.status -eq "partial" -and $checkpoint.phase -eq "done")) { break }
    if (-not $checkpoint.retryAt) {
      throw "Collection paused without a saved retry time; inspect the checkpoint."
    }

    $retryAt = ([DateTimeOffset]$checkpoint.retryAt).UtcDateTime
    $waitSeconds = [Math]::Ceiling(($retryAt - [DateTime]::UtcNow).TotalSeconds) + 3
    if ($waitSeconds -gt 0) {
      Write-Host "GitHub rate limit reached. The saved collection will resume automatically."
      Start-Sleep -Seconds $waitSeconds
    }
  }

  if ($checkpoint.status -eq "complete") {
    Write-Host "GitHub collection completed."
  }
  else {
    Write-Host "Traversal ended with unresolved segments or README exceptions. Run npm run github:status to inspect remaining work."
  }
}
finally {
  Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue
  if ($tokenPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
  }
  if ($null -ne $secureToken) { $secureToken.Dispose() }
  Pop-Location
}
