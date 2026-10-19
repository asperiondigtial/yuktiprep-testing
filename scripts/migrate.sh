#!/usr/bin/env bash
# Run a DB migration phase exactly once per commit.  Usage: migrate.sh <env> <expand|contract> <image@digest>
source "$(dirname "$0")/lib.sh"
env="$1"; phase="$2"; image="$3"; ns=$(ns_for "$env")
sha="${GIT_SHA:-${GITHUB_SHA:-$(git rev-parse HEAD)}}"; short="${sha:0:8}"
case "$phase" in
  expand)   cmd="${MIGRATE_EXPAND_CMD:-echo no expand migration configured}" ;;
  contract) cmd="${MIGRATE_CONTRACT_CMD:-echo no contract migration configured}" ;;
  *) die "phase must be expand|contract" ;;
esac
job="migrate-${phase}-${short}"

if kubectl -n "$ns" get job "$job" >/dev/null 2>&1; then
  if [[ "$(kubectl -n "$ns" get job "$job" -o jsonpath='{.status.succeeded}')" == "1" ]]; then
    log "$job already succeeded - skipping (migration runs once)"; exit 0
  fi
  if [[ -n "$(kubectl -n "$ns" get job "$job" -o jsonpath='{.status.failed}')" ]]; then
    die "$job previously FAILED. Inspect it, then ship a reviewed forward-fix commit (new job name)."
  fi
else
  export NAMESPACE="$ns" JOB_NAME="$job" PHASE="$phase" IMAGE="$image" MIGRATE_CMD="$cmd"
  envsubst '${NAMESPACE} ${JOB_NAME} ${PHASE} ${IMAGE} ${MIGRATE_CMD}' < k8s/jobs/migration.yaml | kubectl apply -f -
fi

log "Waiting for $job ..."
deadline=$(( $(date +%s) + ${MIGRATE_TIMEOUT:-900} ))
while (( $(date +%s) < deadline )); do
  ok=$(kubectl -n "$ns" get job "$job" -o jsonpath='{.status.succeeded}')
  ko=$(kubectl -n "$ns" get job "$job" -o jsonpath='{.status.failed}')
  if [[ "$ok" == "1" ]]; then
    kubectl -n "$ns" logs "job/$job" --tail=100 || true
    updates=("db_schema_version=$short" "last_migration_phase=$phase")
    [[ "$phase" == contract ]] && updates+=("contract_applied=true")
    state_set "$ns" "${updates[@]}"
    log "Migration $phase succeeded"; exit 0
  fi
  if [[ -n "$ko" && "$ko" != "0" ]]; then
    kubectl -n "$ns" logs "job/$job" --tail=200 || true
    kubectl -n "$ns" describe "job/$job" || true
    die "Migration $phase FAILED"
  fi
  sleep 5
done
die "Migration $phase timed out"
