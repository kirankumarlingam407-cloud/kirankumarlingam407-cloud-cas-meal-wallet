$endpoints = @('/', '/scan', '/admin', '/w/tok_aarav_sharma_98f21e847c2')
foreach ($ep in $endpoints) {
  $url = "http://localhost:3000$ep"
  try {
    $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
    Write-Host "$ep -> HTTP $($res.StatusCode) ($($res.RawContentLength) bytes)"
  } catch {
    Write-Host "$ep -> Error: $_"
  }
}
