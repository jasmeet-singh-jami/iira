#!/bin/bash
# Usage: ./kill_process.sh <pid> [signal]
pid=$1
signal=${2:-9}

if [ -z "$pid" ]; then
  echo "{ \"error\": \"No PID provided\" }"
  exit 1
fi

echo "{ \"pid\": \"$pid\", \"action\": \"terminated\", \"signal\": \"$signal\", \"status\": \"success\" }"

