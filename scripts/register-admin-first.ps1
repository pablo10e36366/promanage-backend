<#
PowerShell script to ensure admin user exists, then register the other two users using a valid JWT.
- Steps:
- 1) Create admin@promanage.com if not exists
- 2) Login as admin to obtain JWT
- 3) Use token to register docente@promanage.com and estudiante@promanage.com
- 4) Print a concise summary of results
#>

$baseUri = "http://localhost:3000/api/auth"

# Admin credentials (adjust if you need different values)
$adminName = "Administrador Promanage"
$adminEmail = "admin@promanage.com"
$adminPassword = "Admin123!"

function Register-User([hashtable]$payload, [string]$token) {
  $headers = @{
    Authorization = "Bearer $token"
  }
  $resp = Invoke-RestMethod -Uri "$baseUri/register" -Method Post -ContentType "application/json" -Headers $headers -Body (ConvertTo-Json $payload)
  return $resp
}

try {
  # Step 1: ensure admin exists by trying to register; if conflict, ignore
  $adminPayload = @{ name = $adminName; email = $adminEmail; password = $adminPassword }
  try {
    Invoke-RestMethod -Uri "$baseUri/register" -Method Post -ContentType "application/json" -Body (ConvertTo-Json $adminPayload)
  } catch {
    # If exists or unauthorized, continue
  }

  # Step 2: login as admin to obtain token
  $loginResp = Invoke-RestMethod -Uri "$baseUri/login" -Method Post -ContentType "application/json" -Body (ConvertTo-Json @{ email = $adminEmail; password = $adminPassword })
  $token = $loginResp.access_token

  # Step 3: register the other two users
  $docente = @{ Name = 'Docente Promanage'; Email = 'docente@promanage.com'; Password = 'Docente123!' }
  $estudiante = @{ Name = 'Estudiante Promanage'; Email = 'estudiante@promanage.com'; Password = 'Estudiante123!' }

  $docentePayload = @{ name = $docente.Name; email = $docente.Email; password = $docente.Password }
  $estudiantePayload = @{ name = $estudiante.Name; email = $estudiante.Email; password = $estudiante.Password }

  $docenteResp = Register-User $docentePayload $token
  $estudianteResp = Register-User $estudiantePayload $token

  Write-Host "Admin created/exists: $adminEmail"
  Write-Host "Docente created: $($docente.Email)" -ForegroundColor Green
  Write-Host "Estudiante created: $($estudiante.Email)" -ForegroundColor Green
  Write-Host "Registro completado."
} catch {
  Write-Host "Error durante el proceso: $_" -ForegroundColor Red
  exit 1
}

