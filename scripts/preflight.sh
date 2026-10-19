#!/usr/bin/env bash
# Production (or staging) preflight checks.  Usage: preflight.sh <env>   (optional: IMAGE=registry/name@sha256:...)
source "$(dirname "$0")/lib.sh"
set +e
env="$1"; ns=$(ns_for "$env"); fails=0
chk() { local name="$1"; shift; if "$@" >/dev/null 2>&1; then log "PASS  $name"; else warn "FAIL  $name"; fails=$((fails+1)); fi; }

min_nodes=$([[ $env == production ]] && echo 2 || echo 1)
nodes_ready() { [[ $(kubectl get nodes --no-headers | awk '$2=="Ready"' | wc -l) -ge $min_nodes ]]; }
node_pressure() { # skip when metrics-server is absent
  kubectl top nodes --no-headers >/dev/null 2>&1 || return 0
  ! kubectl top nodes --no-headers | awk '{gsub("%","",$3); gsub("%","",$5); if ($3>80||$5>85) bad=1} END{exit bad?0:1}'
}
k8s_version() { local m; m=$(kubectl version -o json | jq -r '.serverVersion.minor' | tr -dc 0-9); [[ $m -ge ${MIN_K8S_MINOR:-27} ]]; }
deps_ok() {
  local d ns_ name
  for d in ${DEPENDENCY_DEPLOYMENTS:-ingress-nginx/ingress-nginx-controller cert-manager/cert-manager}; do
    ns_=${d%%/*}; name=${d##*/}
    kubectl -n "$ns_" wait --for=condition=Available "deploy/$name" --timeout=20s || return 1
  done
}
ns_exists()  { kubectl get ns "$ns"; }
secrets_ok() { kubectl -n "$ns" get secret app-secrets; }
regcred_ok() { kubectl -n "$ns" get secret regcred; }
tls_ok() {
  kubectl -n "$ns" get certificate app-tls >/dev/null 2>&1 || { warn "certificate app-tls not issued yet (first deploy?)"; return 0; }
  kubectl -n "$ns" wait --for=condition=Ready certificate/app-tls --timeout=10s || return 1
  local na; na=$(kubectl -n "$ns" get certificate app-tls -o jsonpath='{.status.notAfter}')
  (( $(date -d "$na" +%s) - $(date +%s) > 14*86400 ))
}
obs_ok() { [[ -z "${PROMETHEUS_URL:-}" ]] || curl -fsS --max-time 10 "${PROMETHEUS_URL%/}/-/ready"; }
age_ok() { # <configmap key> <max hours>
  local t; t=$(kubectl -n "$ns" get cm backup-evidence -o "jsonpath={.data.$1}") || return 1
  [[ -n "$t" ]] && (( $(date +%s) - $(date -d "$t" +%s) < $2*3600 ))
}
no_migration_running() { [[ -z "$(kubectl -n "$ns" get jobs -l app.kubernetes.io/component=migration -o json | jq -r '.items[]|select(.status.active>0)|.metadata.name')" ]]; }
no_lock() { ! kubectl -n "$ns" get cm deploy-lock; }
image_ok() { [[ -z "${IMAGE:-}" ]] || bash "$(dirname "$0")/verify-image.sh" "$IMAGE"; }

log "Quota snapshot:"; kubectl -n "$ns" get resourcequota 2>/dev/null
chk "nodes Ready (>= $min_nodes)"                nodes_ready
chk "node CPU/memory headroom"                   node_pressure
chk "Kubernetes runtime >= 1.${MIN_K8S_MINOR:-27}" k8s_version
chk "dependencies available"                     deps_ok
chk "namespace $ns exists"                       ns_exists
chk "secret app-secrets present"                 secrets_ok
chk "registry pull secret present"               regcred_ok
chk "TLS certificate valid > 14d"                tls_ok
chk "observability reachable"                    obs_ok
chk "backup fresher than ${MAX_BACKUP_AGE_HOURS:-24}h" age_ok last_backup_time "${MAX_BACKUP_AGE_HOURS:-24}"
chk "restore test within ${MAX_RESTORE_TEST_DAYS:-30}d" age_ok last_restore_test_time "$(( ${MAX_RESTORE_TEST_DAYS:-30} * 24 ))"
chk "no migration running (migration locks)"     no_migration_running
chk "no deployment lock held"                    no_lock
chk "image signature/provenance/SBOM"            image_ok

(( fails == 0 )) && { log "Preflight PASSED for $env"; exit 0; }
die "Preflight FAILED ($fails checks) - hold release and resolve blockers"
