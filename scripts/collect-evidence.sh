#!/usr/bin/env bash
# Capture logs, traces pointers, metrics snapshot and release metadata.  Usage: collect-evidence.sh <env> <outdir>
source "$(dirname "$0")/lib.sh"; set +e
ns=$(ns_for "$1"); out="${2:-evidence}"; mkdir -p "$out"
kubectl -n "$ns" get all,ingress,hpa,pdb,cm,jobs,certificate -o wide > "$out/resources.txt" 2>&1
kubectl -n "$ns" get events --sort-by=.lastTimestamp > "$out/events.txt" 2>&1
kubectl -n "$ns" describe pods -l app.kubernetes.io/name=app > "$out/describe-pods.txt" 2>&1
for p in $(kubectl -n "$ns" get pods -l app.kubernetes.io/name=app -o name); do
  kubectl -n "$ns" logs "$p" --all-containers --tail=500 > "$out/log-$(basename "$p").txt" 2>&1
  kubectl -n "$ns" logs "$p" --all-containers --previous --tail=200 > "$out/log-$(basename "$p")-previous.txt" 2>&1
done
for j in $(kubectl -n "$ns" get jobs -l app.kubernetes.io/component=migration -o name); do
  kubectl -n "$ns" logs "$j" --tail=300 > "$out/log-$(basename "$j").txt" 2>&1
done
kubectl -n "$ns" get cm release-state -o yaml > "$out/release-state.yaml" 2>&1
kubectl -n "$ns" rollout history "deploy/$APP" > "$out/rollout-history.txt" 2>&1
[[ -n "${PROMETHEUS_URL:-}" ]] && curl -fsS "${PROMETHEUS_URL%/}/api/v1/alerts" > "$out/alerts.json" 2>&1
echo "run=${GITHUB_RUN_ID:-local} sha=${GITHUB_SHA:-?} image=$(state_get "$ns" candidate_image)" > "$out/release-metadata.txt"
log "Evidence written to $out"
