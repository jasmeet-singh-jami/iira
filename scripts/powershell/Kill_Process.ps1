param(
    [int]$pid,
    [int]$signal = 9
)

try {
    Stop-Process -Id $pid -Force
    $result = @{
        pid     = $pid
        action  = "terminated"
        signal  = $signal
        status  = "success"
    }
    $result | ConvertTo-Json
}
catch {
    $result = @{
        pid     = $pid
        action  = "terminate"
        status  = "failed"
        error   = $_.Exception.Message
    }
    $result | ConvertTo-Json
}
