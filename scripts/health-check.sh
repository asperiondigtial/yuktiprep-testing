#!/usr/bin/env bash
# Evaluate release health for a window.  Usage: health-check.sh <env> <duration_s> <interval_s>
# Thresholds (override via env): MAX_ERROR_RATE=0.01 MAX_P95_SECONDS=1.0 MAX_LATENCY_SECONDS=1.5 MAX_RESTART_DELTA=0
# Optional: PROMETHEUS_URL (+ ERROR_RATE_QUERY / P95_QUERY), HOOK_TARGETS="check-db-health check-business-journeys check-security-signals"
source "$(dirname "$0")/lib.sh"
set +e
env="$1"; dur="${2:-60}"; every="${3:-15}"; ns=$(ns_for "$env"); url=$(url_for "$env")
max_err="${MAX_ERROR_RATE:-0.01}"; max_p95="${MAX_P95_SECONDS:-1.0}"; max_lat="${MAX_LATENCY_SECONDS:-1.5}"; max_rst="${MAX_RESTART_DELTA:-0}"
need_consecutive="${FAIL_THRESHOLD:-2}"

restarts() { kubectl -n "$ns" get pods -l app.kubernetes.io/name=app -o json | jq '[.items[].status.containerStatuses[]?.restartCount]|add // 0'; }
prom() { curl -fsS --max-time 10 -G "${PROMETHEUS_URL%/}/api/v1/query" --data-urlencode "query=$1" | jq -r '.data.result[0].value[1] // "0"'; }
gt() { awk -v a="$1" -v b="$2" 'BEGIN{exit !(a>b)}'; }

err_q="${ERROR_RATE_QUERY:-sum(rate(nginx_ingress_controller_requests{exported_namespace=\"$ns\",status=~\"5..\"}[5m])) / clamp_min(sum(rate(nginx_ingress_controller_requests{exported_namespace=\"$ns\"}[5m])),1e-9)}"
p95_q="${P95_QUERY:-histogram_quantile(0.95,sum(rate(nginx_ingress_controller_request_duration_seconds_bucket{exported_namespace=\"$ns\"}[5m])) by (le))}"

base_rst=$(restarts); start=$(date +%s); consecutive=0; round=0
while :; do
  round=$((round+1)); breach=()
  # 1) availability / latency probe
  out=$(curl -s -o /dev/null -w '%{http_code} %{time_total}' --max-time 10 "${url%/}/ready"); code=${out% *}; lat=${out#* }
  [[ "$code" == 200 ]] || breach+=("availability: /ready returned $code")
  gt "$lat" "$max_lat" && breach+=("latency: probe ${lat}s > ${max_lat}s")
  if [[ -n "${PROMETHEUS_URL:-}" ]]; then
    e=$(prom "$err_q"); gt "$e" "$max_err" && breach+=("error rate $e > $max_err")
    p=$(prom "$p95_q"); gt "$p" "$max_p95" && breach+=("p95 ${p}s > ${max_p95}s")
  fi
  # 2) CPU / memory / restarts / readiness
  r=$(restarts); (( r - base_rst > max_rst )) && breach+=("container restarts +$((r-base_rst))")
  notready=$(kubectl -n "$ns" get pods -l app.kubernetes.io/name=app -o json | jq '[.items[]|select(.status.phase=="Running")|select(([.status.conditions[]|select(.type=="Ready")][0].status)!="True")]|length')
  (( notready > 0 )) && breach+=("$notready pod(s) not Ready")
  # 3) DB/dependencies + business journeys + security signals (project hooks in Makefile)
  for t in ${HOOK_TARGETS:-}; do make -s "$t" BASE_URL="$url" >/dev/null 2>&1 || breach+=("hook $t failed"); done

  if ((${#breach[@]})); then
    consecutive=$((consecutive+1)); warn "round $round BREACH ($consecutive/$need_consecutive): ${breach[*]}"
    (( consecutive >= need_consecutive )) && die "Release thresholds NOT satisfied"
  else
    consecutive=0; log "round $round healthy (probe ${lat}s, restarts +$((r-base_rst)))"
  fi
  (( $(date +%s) - start >= dur )) && break
  sleep "$every"
done
log "Release thresholds satisfied"
