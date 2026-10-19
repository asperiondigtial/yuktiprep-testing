#!/usr/bin/env bash
# Complete traffic promotion.  Usage: promote.sh <env>
source "$(dirname "$0")/lib.sh"
env="$1"; ns=$(ns_for "$env"); strategy=$(state_get "$ns" strategy); image=$(state_get "$ns" candidate_image)
here="$(dirname "$0")"
case "$strategy" in
  rolling) : ;;
  canary)
    for w in ${CANARY_STEPS:-25 50}; do
      kubectl -n "$ns" annotate ingress app-canary "nginx.ingress.kubernetes.io/canary-weight=$w" --overwrite
      log "Canary at ${w}%"
      bash "$here/health-check.sh" "$env" "${CANARY_STEP_SECONDS:-60}" 15
    done
    active=$(active_deploy "$ns")
    kubectl -n "$ns" set image "deploy/$active" "app=$image"
    kubectl -n "$ns" rollout status "deploy/$active" --timeout="${ROLLOUT_TIMEOUT:-600s}"
    kubectl -n "$ns" delete ingress/app-canary svc/app-canary "deploy/$APP-canary" --ignore-not-found ;;
  blue-green)
    pending=$(state_get "$ns" pending_slot); [[ -n "$pending" ]] || die "no pending slot"
    kubectl -n "$ns" patch svc "$APP" -p "{\"spec\":{\"selector\":{\"slot\":\"$pending\"}}}"
    kubectl -n "$ns" delete svc app-preview --ignore-not-found
    log "Traffic switched to slot $pending (old slot kept running as rollback target)" ;;
  *) die "unknown strategy '$strategy'" ;;
esac
state_set "$ns" "current_image=$image" "status=promoted" "promoted_at=$(date -u +%FT%TZ)"
log "Promotion complete"
