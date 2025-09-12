#!/bin/bash
# Usage: ./get_top_process.sh [metric] [limit]
metric=${1:-cpu}
limit=${2:-1}

# Use ps to get top process by CPU
process=$(ps -eo pid,comm,%cpu --sort=-%cpu | awk 'NR==2 {print $1, $2, $3}')

if [ -n "$process" ]; then
  pid=$(echo $process | awk '{print $1}')
  pname=$(echo $process | awk '{print $2}')
  cpu=$(echo $process | awk '{print $3}')
  echo "{ \"process_id\": \"$pid\", \"process_name\": \"$pname\", \"cpu_time\": \"$cpu\" }"
else
  echo "{ \"error\": \"No processes found\" }"
fi
