#!/usr/bin/env bash
# Deploy exact image digest.  Usage: deploy.sh <env> <rolling|canary|blue-green> <image@digest>
# rolling    : update active Deployment in place (maxUnavailable=0)
# canary     : start app-canary + nginx canary ingress at CANARY_WEIGHT %   (finish with promote.sh)
# blue-green : bring up the inactive slot, validate via app-preview         (finish with promote.sh)
source "$(dirname "$0")/lib.sh"
env="$1"; strategy="$2"; image="$3"; ns=$(ns_for "$env"); overlay=$(overlay_for "$env")
[[ "$image" == *@sha256:* ]] || die "image must be pinned by digest"
repo="${image%@*}"

first=true; kubectl -n "$ns" get deploy "$APP" >/dev/null 2>&1 && first=false
[[ "$first" == true ]] && strategy=rolling && log "First deployment in $ns - using rolling"

active=$(active_deploy "$ns"); [[ "$first" == true ]] && active="$APP"
previous=$([[ "$first" == false ]] && deploy_image "$ns" "$active" || true)

# Apply manifests. For canary/blue-green the base Deployment keeps its CURRENT image.
apply_image="$image"
if [[ "$first" == false && "$strategy" != rolling ]]; then apply_image=$(deploy_image "$ns" "$APP" || echo "$image"); fi
( cd "$overlay" && kustomize edit set image "app=${apply_image}" )
# storage first (Utho CSI PVCs), then everything else
kubectl kustomize "$overlay" | kubectl apply -f - -l app.kubernetes.io/component=storage 2>/dev/null || true
kubectl apply -k "$overlay"
[[ -z "$(active_slot "$ns")" ]] && kubectl -n "$ns" patch svc "$APP" -p '{"spec":{"selector":{"slot":"base"}}}'
active=$(active_deploy "$ns")

state_set "$ns" "strategy=$strategy" "candidate_image=$image" "previous_image=${previous:-}" "previous_slot=$(active_slot "$ns")"
timeout="${ROLLOUT_TIMEOUT:-600s}"

case "$strategy" in
  rolling)
    kubectl -n "$ns" set image "deploy/$active" "app=$image"
    kubectl -n "$ns" rollout status "deploy/$active" --timeout="$timeout" ;;

  canary)
    replicas="${CANARY_REPLICAS:-1}"
    clone_deploy "$ns" "$active" "$APP-canary" canary "$image" "$replicas"
    kubectl -n "$ns" rollout status "deploy/$APP-canary" --timeout="$timeout"
    export NAMESPACE="$ns" CANARY_WEIGHT="${CANARY_WEIGHT:-10}"
    export HOST=$(kubectl -n "$ns" get ingress "$APP" -o jsonpath='{.spec.rules[0].host}')
    envsubst '${NAMESPACE}' < k8s/strategies/canary/service.yaml | kubectl apply -f -
    envsubst '${NAMESPACE} ${CANARY_WEIGHT} ${HOST}' < k8s/strategies/canary/ingress.yaml | kubectl apply -f -
    log "Canary receiving ${CANARY_WEIGHT}% of traffic" ;;

  blue-green)
    cur=$(active_slot "$ns"); cur=${cur:-base}
    [[ "$cur" == base ]] && inactive=green || inactive=base
    target=$(slot_deploy "$inactive"); replicas=$(kubectl -n "$ns" get deploy "$active" -o jsonpath='{.spec.replicas}')
    if kubectl -n "$ns" get deploy "$target" >/dev/null 2>&1; then
      kubectl -n "$ns" scale "deploy/$target" --replicas="$replicas"
      kubectl -n "$ns" set image "deploy/$target" "app=$image"
    else
      clone_deploy "$ns" "$active" "$target" "$inactive" "$image" "$replicas"
    fi
    kubectl -n "$ns" rollout status "deploy/$target" --timeout="$timeout"
    export NAMESPACE="$ns" SLOT="$inactive"
    envsubst '${NAMESPACE} ${SLOT}' < k8s/strategies/blue-green/preview-service.yaml | kubectl apply -f -
    state_set "$ns" "pending_slot=$inactive"
    log "Validate inactive environment before traffic switch"
    kubectl -n "$ns" port-forward svc/app-preview 18080:80 >/tmp/pf.log 2>&1 & pf=$!
    trap 'kill $pf 2>/dev/null || true' EXIT
    sleep 3
    bash "$(dirname "$0")/smoke.sh" "http://127.0.0.1:18080" ;;
  *) die "unknown strategy $strategy" ;;
esac
log "Deploy ($strategy) of $image complete in $ns"
