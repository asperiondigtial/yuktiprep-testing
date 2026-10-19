#!/usr/bin/env bash
# Artifact policy: image must be pinned by digest, signed by THIS repo's workflows, and carry provenance + SBOM.
# Usage: verify-image.sh <registry/name@sha256:...>
source "$(dirname "$0")/lib.sh"
image="${1:?image@digest required}"
[[ "$image" == *@sha256:* ]] || die "image must be pinned by digest: $image"
repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY not set}"

log "Verifying signature for $image"
cosign verify "$image" \
  --certificate-identity-regexp "^https://github.com/${repo}/\.github/workflows/.+@refs/.+$" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com >/dev/null

log "Verifying provenance and SBOM attestations"
docker buildx imagetools inspect "$image" --format '{{ json .Provenance }}' | jq -e '. != null and . != {}' >/dev/null || die "no provenance"
docker buildx imagetools inspect "$image" --format '{{ json .SBOM }}'       | jq -e '. != null and . != {}' >/dev/null || die "no SBOM"
log "Artifact policy passed"
