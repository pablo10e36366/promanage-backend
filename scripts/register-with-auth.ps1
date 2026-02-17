<#
PowerShell script to login as admin and register three users via the NestJS API using authorization.
- Assumes backend is running at http://localhost:3000/api/auth
- First logs in as admin@promanage.com to acquire a JWT
- Then creates Administrador, Docente, and Estudiante with Authorization header
- Outputs a simple summary to console
#>

$baseUri = "http://localhost:3000/api/auth"

# Login as admin to obtain token
$login = Invoke-RestMethod -Uri "$baseUri/login" -Method Post -ContentType "application/json" -Body (ConvertTo-Json @{ email = 'admin@example.com'; password = 'admin123' })
$token = $login.access_token
$headers = @{
  Authorization = "Bearer $token"
}

$users = @(
  @{ Name = 'Administrador Promanage'; Email = 'admin@promanage.com'; Password = 'Admin123!' },
  @{ Name = 'Docente Promanage'; Email = 'docente@promanage.com'; Password = 'Docente123!' },
  @{ Name = 'Estudiante Promanage'; Email = 'estudiante@promanage.com'; Password = 'Estudiante123!' }
)

foreach ($u in $users) {
  $payload = @{ name = $u.Name; email = $u.Email; password = $u.Password }
  try {
    $resp = Invoke-RestMethod -Uri "$baseUri/register" -Method Post -ContentType "application/json" -Headers $headers -Body (ConvertTo-Json $payload)
    Write-Host "Created user: $($u.Email) -> $($resp | ConvertTo-Json -Depth 5)"
  } catch {
    $err = $_.Exception.Message
    Write-Host "Failed to create user: $($u.Email) - $err" -ForegroundColor Red
  }
}

