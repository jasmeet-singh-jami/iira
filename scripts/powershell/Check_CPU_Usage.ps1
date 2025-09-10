param(
    [int]$threshold = 80
)

$cpuLoad = Get-Counter '\Processor(_Total)\% Processor Time' | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue

$status = if ($cpuLoad -lt $threshold) {
    "normal"
} else {
    "high"
}

$result = @{
    cpu_load = [math]::Round($cpuLoad, 2)
    threshold = $threshold
    status = $status
}
$result | ConvertTo-Json
