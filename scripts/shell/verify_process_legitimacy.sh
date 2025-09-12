#!/bin/bash
# Usage: ./verify_process_legitimacy.sh <process_name> <user>
pname=$1
user=$2

safe_processes=("systemd" "sshd" "bash" "postgres" "nginx")

status="rogue"
for sp in "${safe_processes[@]}"; do
  if [ "$pname" == "$sp" ]; then
    status="safe"
    break
  fi
done

echo "{ \"process_name\": \"$pname\", \"user\": \"$user\", \"status\": \"$status\" }"
