#!/usr/bin/env bash
# Usage: smoke.sh <base_url>
source "$(dirname "$0")/lib.sh"
url="${1:?base url required}"
for p in /healthz /ready; do
  curl --fail --silent --show-error --retry 10 --retry-delay 3 --retry-all-errors --max-time 10 -o /dev/null "${url%/}$p"
  log "OK ${url%/}$p"
done
make -s test-smoke BASE_URL="$url"
