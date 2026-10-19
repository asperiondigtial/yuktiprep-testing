#!/usr/bin/env bash
# Disable affected features and halt new traffic to the candidate.  Usage: disable-features.sh <env> [feature,feature...]
source "$(dirname "$0")/lib.sh"
env="$1"; ns=$(ns_for "$env"); features="${2:-${AFFECTED_FEATURES:-}}"
kubectl -n "$ns" delete ingress/app-canary --ignore-not-found          # halt new traffic to canary
if [[ -n "$features" ]]; then
  kubectl -n "$ns" patch cm app-config --type merge -p "$(jq -nc --arg v "$features" '{data:{FEATURES_DISABLED:$v}}')"
  [[ "${RESTART_AFTER_DISABLE:-false}" == true ]] && kubectl -n "$ns" rollout restart "deploy/$(active_deploy "$ns")"
  log "Disabled features: $features"
fi
