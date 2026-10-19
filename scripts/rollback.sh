#!/usr/bin/env bash
# Restore previous image digests or switch traffic back.  Usage: rollback.sh <env>
source "$(dirname "$0")/lib.sh"
env="$1"; ns=$(ns_for "$env"); strategy=$(state_get "$ns" strategy)
prev_image=$(state_get "$ns" previous_image); prev_slot=$(state_get "$ns" previous_slot)

kubectl -n "$ns" delete ingress/app-canary svc/app-canary "deploy/$APP-canary" svc/app-preview --ignore-not-found

if [[ "$strategy" == blue-green ]]; then
  cur=$(active_slot "$ns")
  if [[ -n "$prev_slot" && "$prev_slot" != "$cur" ]]; then
    kubectl -n "$ns" patch svc "$APP" -p "{\"spec\":{\"selector\":{\"slot\":\"$prev_slot\"}}}"
    log "Traffic switched back to slot $prev_slot"
  else
    log "Traffic never left slot $cur"
  fi
else
  active=$(active_deploy "$ns")
  cur_img=$(deploy_image "$ns" "$active")
  if [[ -n "$prev_image" && "$cur_img" != "$prev_image" ]]; then
    kubectl -n "$ns" set image "deploy/$active" "app=$prev_image"
  elif [[ -z "$prev_image" ]]; then
    kubectl -n "$ns" rollout undo "deploy/$active"
  fi
  kubectl -n "$ns" rollout status "deploy/$active" --timeout="${ROLLOUT_TIMEOUT:-600s}"
fi
state_set "$ns" "status=rolled_back" "rolled_back_at=$(date -u +%FT%TZ)"
log "Rollback complete"
