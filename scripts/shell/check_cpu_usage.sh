#!/bin/bash
# Usage: ./check_cpu_usage.sh [threshold]
threshold=${1:-80}

cpu_load=$(top -bn1 | grep "Cpu(s)" | awk '{print 100 - $8}')
cpu_load=$(printf "%.2f" $cpu_load)

if (( $(echo "$cpu_load < $threshold" | bc -l) )); then
  status="normal"
else
  status="high"
fi

echo "{ \"cpu_load\": \"$cpu_load\", \"threshold\": \"$threshold\", \"status\": \"$status\" }"
