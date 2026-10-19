#!/usr/bin/env bash
# Validate deployment + traffic routing: endpoints, Utho LB address, DNS, cert-manager TLS.  Usage: verify-routing.sh <env>
source "$(dirname "$0")/lib.sh"
env="$1"; ns=$(ns_for "$env")
host=$(kubectl -n "$ns" get ingress "$APP" -o jsonpath='{.spec.rules[0].host}')
eps=$(kubectl -n "$ns" get endpoints "$APP" -o jsonpath='{.subsets[*].addresses[*].ip}')
[[ -n "$eps" ]] || die "Service $APP has no ready endpoints"
log "Endpoints: $eps"
for i in $(seq 1 30); do
  lb=$(kubectl -n "$ns" get ingress "$APP" -o jsonpath='{.status.loadBalancer.ingress[0].ip}{.status.loadBalancer.ingress[0].hostname}')
  [[ -n "$lb" ]] && break; sleep 10
done
[[ -n "${lb:-}" ]] || die "Ingress has no load balancer address"
log "Load balancer: $lb"
getent hosts "$host" >/dev/null || die "DNS for $host does not resolve"
kubectl -n "$ns" wait --for=condition=Ready certificate/app-tls --timeout=300s || die "TLS certificate not Ready"
curl --fail --silent --show-error --max-time 15 -o /dev/null "https://$host/healthz"
log "Routing, DNS and TLS verified for https://$host"
