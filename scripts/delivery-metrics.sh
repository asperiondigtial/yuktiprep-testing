#!/usr/bin/env bash
# Delivery metrics for the last N days (default 30) using the GitHub CLI.  Usage: delivery-metrics.sh [days]
set -Eeuo pipefail
days="${1:-30}"; since=$(date -u -d "-${days} days" +%F); repo="${GITHUB_REPOSITORY:?}"
runs() { gh run list -R "$repo" --workflow "$1" --created ">=$since" --limit 500 --json conclusion,createdAt,updatedAt; }
rel=$(runs 02-release.yml); rb=$(runs 04-rollback.yml); ci=$(runs 01-ci.yml)
dur() { jq '[.[]|select(.conclusion=="success")|((.updatedAt|fromdateiso8601)-(.createdAt|fromdateiso8601))]|sort|if length==0 then 0 else .[length/2|floor] end'; }
total=$(jq 'length' <<<"$rel"); ok=$(jq '[.[]|select(.conclusion=="success")]|length' <<<"$rel"); rbs=$(jq 'length' <<<"$rb")
cat <<MD
## Delivery metrics (last ${days} days)
| Metric | Value |
|---|---|
| Release runs | ${total} |
| Successful production releases | ${ok} |
| Deployment frequency | $(awk -v n="$ok" -v d="$days" 'BEGIN{printf "%.2f / week", n*7/d}') |
| Change failure rate | $(awk -v f="$((total-ok))" -v t="$total" 'BEGIN{printf "%.1f%%", t? f*100/t : 0}') |
| Rollback runs | ${rbs} |
| Median CI duration | $(dur <<<"$ci") s |
| Median release duration | $(dur <<<"$rel") s |
MD
