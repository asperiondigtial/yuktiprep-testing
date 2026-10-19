#!/usr/bin/env bash
# Production deployment lock (atomic ConfigMap create). Usage: lock.sh <env> acquire|release
source "$(dirname "$0")/lib.sh"
env="$1"; action="$2"; ns=$(ns_for "$env"); holder="${GITHUB_RUN_ID:-manual}"; ttl_min="${LOCK_TTL_MIN:-60}"
case "$action" in
  acquire)
    for _ in 1 2; do
      if kubectl -n "$ns" create configmap deploy-lock --from-literal=holder="$holder" --from-literal=since="$(date -u +%FT%TZ)" >/dev/null 2>&1; then
        log "Deployment lock acquired by run $holder"; exit 0
      fi
      since=$(kubectl -n "$ns" get cm deploy-lock -o jsonpath='{.data.since}' 2>/dev/null || true)
      if [[ -n "$since" ]] && (( $(date +%s) - $(date -d "$since" +%s) > ttl_min*60 )); then
        warn "Stale lock (older than ${ttl_min}m) - removing"; kubectl -n "$ns" delete cm deploy-lock --ignore-not-found
      else
        die "Deployment lock held by run $(kubectl -n "$ns" get cm deploy-lock -o jsonpath='{.data.holder}' 2>/dev/null)"
      fi
    done
    die "could not acquire lock" ;;
  release)
    [[ "$(kubectl -n "$ns" get cm deploy-lock -o jsonpath='{.data.holder}' 2>/dev/null || true)" == "$holder" ]] \
      && kubectl -n "$ns" delete cm deploy-lock --ignore-not-found && log "Lock released" || true ;;
  *) die "usage: lock.sh <env> acquire|release" ;;
esac
