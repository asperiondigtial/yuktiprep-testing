#!/usr/bin/env bash
# Release manifest: digests, config version, DB version, rollback target.  Usage: create-release-manifest.sh <image@digest> <out.json>
source "$(dirname "$0")/lib.sh"
image="$1"; out="${2:-release-manifest.json}"; ns=$(ns_for production)
cfg_hash=$(kubectl kustomize k8s/overlays/production | sha256sum | cut -d' ' -f1)
jq -n --arg sha "${GIT_SHA:-$GITHUB_SHA}" --arg image "$image" --arg cfg "$cfg_hash" \
      --arg dbv "$(state_get "$ns" db_schema_version)" --arg rb "$(state_get "$ns" current_image)" \
      --arg run "${GITHUB_RUN_ID:-local}" --arg ts "$(date -u +%FT%TZ)" \
 '{git_sha:$sha, image:$image, kustomize_config_sha256:$cfg, database_version_before_release:($dbv|if .=="" then "unknown" else . end),
   rollback_target_image:($rb|if .=="" then "none (first release)" else . end), workflow_run:$run, created_at:$ts}' > "$out"
cat "$out"
