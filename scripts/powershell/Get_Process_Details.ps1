param(
    [int]$pid
)

try {
    $proc = Get-Process -Id $pid -ErrorAction Stop
    $user = (Get-CimInstance Win32_Process -Filter "ProcessId=$pid").GetOwner().User

    $result = @{
        pid          = $proc.Id
        process_name = $proc.ProcessName
        user         = $user
        cmdline      = (Get-CimInstance Win32_Process -Filter "ProcessId=$pid").CommandLine
    }
    $result | ConvertTo-Json
}
catch {
    Write-Error "Process with PID $pid not found"
}
