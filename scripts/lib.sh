#!/usr/bin/env bash
# Shared helpers. Source this file: `source "$(dirname "$0")/lib.sh"`
set -Eeuo pipefail

log()  { printf '\033[1;34m[%s]\033[0m %s\n' "$(date -u +%H:%M:%S)" "$*"; }
warn() { printf '\033[1;33m[WARN]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*" >&2; exit 1; }

APP=app

ns_for() {
  case "$1" in
    staging)    echo "${STAGING_NAMESPACE:-app-staging}" ;;
    production) echo "${PRODUCTION_NAMESPACE:-app-production}" ;;
    *) die "unknown environment '$1' (use staging|production)" ;;
  esac
}
url_for() {
  case "$1" in
    staging)    echo "${STAGING_URL:?STAGING_URL is not set}" ;;
    production) echo "${PRODUCTION_URL:?PRODUCTION_URL is not set}" ;;
  esac
}
overlay_for() { echo "k8s/overlays/$1"; }

# --- blue/green slot helpers: Service `app` selector carries `slot: base|green`
active_slot()   { kubectl -n "$1" get svc "$APP" -o jsonpath='{.spec.selector.slot}' 2>/dev/null || true; }
slot_deploy()   { if [[ "${1:-base}" == base || -z "${1:-}" ]]; then echo "$APP"; else echo "$APP-$1"; fi; }
active_deploy() { slot_deploy "$(active_slot "$1")"; }
deploy_image()  { kubectl -n "$1" get deploy "$2" -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || true; }

# --- release-state ConfigMap (db version, rollback target, strategy, ...)
state_get() { kubectl -n "$1" get cm release-state -o "jsonpath={.data.$2}" 2>/dev/null || true; }
state_set() {
  local ns="$1"; shift
  kubectl -n "$ns" get cm release-state >/dev/null 2>&1 || kubectl -n "$ns" create cm release-state >/dev/null
  local kv k v
  for kv in "$@"; do
    k="${kv%%=*}"; v="${kv#*=}"
    kubectl -n "$ns" patch cm release-state --type merge -p "$(jq -nc --arg k "$k" --arg v "$v" '{data:{($k):$v}}')" >/dev/null
  done
}

# --- clone an existing Deployment under a new name/slot/image (used by canary & blue-green)
clone_deploy() { # ns src name slot image replicas
  kubectl -n "$1" get deploy "$2" -o json | jq \
    --arg name "$3" --arg slot "$4" --arg img "$5" --argjson rep "$6" '
    del(.metadata.uid,.metadata.resourceVersion,.metadata.creationTimestamp,.metadata.generation,
        .metadata.managedFields,.metadata.ownerReferences,.status,
        .metadata.annotations["deployment.kubernetes.io/revision"],
        .metadata.annotations["kubectl.kubernetes.io/last-applied-configuration"])
    | .metadata.name=$name
    | .metadata.labels.slot=$slot
    | .spec.replicas=$rep
    | .spec.selector.matchLabels.slot=$slot
    | .spec.template.metadata.labels.slot=$slot
    | .spec.template.spec.containers[0].image=$img' \
  | kubectl -n "$1" apply -f -
}
