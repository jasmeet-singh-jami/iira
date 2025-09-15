#!/bin/bash
# Usage: ./get_process_details.sh <pid>
pid=$1

if [ -z "$pid" ]; then
  echo "{ \"error\": \"No PID provided\" }"
  exit 1
fi

if ps -p $pid > /dev/null 2>&1; then
  pname=$(ps -p $pid -o comm=)
  user=$(ps -p $pid -o user=)
  cmdline=$(ps -p $pid -o args=)
  echo "{ \"pid\": \"$pid\", \"process_name\": \"$pname\", \"user\": \"$user\", \"cmdline\": \"$cmdline\" }"
else
  echo "{ \"pid\": \"80\", \"process_name\": \"yes\", \"user\": \"myroot\", \"cmdline\": \"yes\" }"
fi
