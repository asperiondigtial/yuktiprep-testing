#!/usr/bin/env bash
# Usage: sync-registry-secret.sh <env>   (needs REGISTRY, REGISTRY_USERNAME, REGISTRY_PASSWORD)
source "$(dirname "$0")/lib.sh"
ns=$(ns_for "$1")
kubectl create secret docker-registry regcred -n "$ns" \
  --docker-server="${REGISTRY:?}" --docker-username="${REGISTRY_USERNAME:?}" --docker-password="${REGISTRY_PASSWORD:?}" \
  --dry-run=client -o yaml | kubectl apply -f -
log "regcred synced in $ns"
