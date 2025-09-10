param(
    [string]$metric = "cpu",
    [int]$limit = 1
)

# Get top process sorted by CPU usage
$process = Get-Process | Sort-Object CPU -Descending | Select-Object -First $limit

if ($process) {
    $result = @{
        process_id   = $process.Id
        process_name = $process.ProcessName
        cpu_time     = $process.CPU
    }
    $result | ConvertTo-Json
} else {
    Write-Error "No processes found"
}
