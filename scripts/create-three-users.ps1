<#
PowerShell script to create three users in one go via the NestJS register endpoint.
- It uses Invoke-RestMethod to POST to /api/auth/register for Admin, Docente, and Estudiante.
- It handles errors per user and prints a summary table.
- Requires the backend to be running on http://localhost:3000.
-- Note: Passwords are not hashed manually; the server hashes them.
#>

$baseUri = "http://localhost:3000/api/auth/register"

$users = @(
  @{ Name = 'Administrador Promanage'; Email = 'admin@promanage.com'; Password = 'Admin123!' },
  @{ Name = 'Docente Promanage'; Email = 'docente@promanage.com'; Password = 'Docente123!' },
  @{ Name = 'Estudiante Promanage'; Email = 'estudiante@promanage.com'; Password = 'Estudiante123!' }
)

$results = @()

foreach ($u in $users) {
  $payload = @{ name = $u.Name; email = $u.Email; password = $u.Password }
  try {
    $resp = Invoke-RestMethod -Uri $baseUri -Method Post -ContentType 'application/json' -Body ($payload | ConvertTo-Json -Depth 5)
    $results += [pscustomobject]@{ Name = $u.Name; Email = $u.Email; Status = 'Success'; Detail = ($resp | ConvertTo-Json -Depth 5) }
    Write-Host "Created user: $($u.Email)"
  } catch {
    $err = $_.Exception.Message
    $results += [pscustomobject]@{ Name = $u.Name; Email = $u.Email; Status = 'Failed'; Detail = $err }
    Write-Host "Failed to create user: $($u.Email) - $err" -ForegroundColor Red
  }
}

Write-Host "`nSummary:`n" -NoNewline
$results | Format-Table -AutoSize

if ($results | Where-Object { $_.Status -ne 'Success' }) {
  exit 1
}

