# Stripe TEST helper (Windows PowerShell 5.1+).
# Asks for the restricted Test key without echoing it, keeps it in this
# process only, runs the task, then removes it from the environment.
#   .\scripts\stripe-test.ps1 -Task cleanup   # list + expire test sessions
#   .\scripts\stripe-test.ps1 -Task test      # real Stripe Test idempotency test
param([Parameter(Mandatory = $true)][ValidateSet("cleanup", "test")][string]$Task)

$secure = Read-Host "Cle Stripe rk_test (masquee)" -AsSecureString
$env:STRIPE_TEST_KEY = [System.Net.NetworkCredential]::new("", $secure).Password
$secure.Dispose()
try {
  if ($Task -eq "cleanup") { node scripts/stripe-test-cleanup.mjs }
  else { npm run test:stripe-real }
}
finally {
  Remove-Item Env:STRIPE_TEST_KEY -ErrorAction SilentlyContinue
}
