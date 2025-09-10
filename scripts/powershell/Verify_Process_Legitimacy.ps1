param(
    [string]$process_name,
    [string]$user
)

# Define some known safe processes (expand as needed)
$safeProcesses = @("System", "svchost", "lsass", "explorer", "services", "wininit")

$status = if ($safeProcesses -contains $process_name) {
    "safe"
} else {
    "rogue"
}

$result = @{
    process_name = $process_name
    user         = $user
    status       = $status
}
$result | ConvertTo-Json
