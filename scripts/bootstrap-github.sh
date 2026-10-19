#!/usr/bin/env bash
# One-time repo setup: protected main + deployment environments. Needs `gh` authenticated as a repo admin.
# Usage: REVIEWER_TEAM_SLUG=release-approvers ./scripts/bootstrap-github.sh <owner/repo>
set -Eeuo pipefail
repo="${1:?owner/repo}"; owner="${repo%%/*}"; team="${REVIEWER_TEAM_SLUG:?set REVIEWER_TEAM_SLUG}"

echo "== Protected main branch (code owner + security review, required CI + staging checks)"
gh api -X PUT "repos/$repo/branches/main/protection" --input - <<JSON
{
  "required_status_checks": {"strict": true, "contexts": ["All required CI checks pass?", "Staging acceptance criteria pass?"]},
  "enforce_admins": true,
  "required_pull_request_reviews": {"required_approving_review_count": 1, "require_code_owner_reviews": true, "dismiss_stale_reviews": true},
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "restrictions": null
}
JSON

team_id=$(gh api "orgs/$owner/teams/$team" --jq .id)
mk_env() { # name with_reviewers
  if [[ "$2" == yes ]]; then
    gh api -X PUT "repos/$repo/environments/$1" --input - <<JSON
{"reviewers":[{"type":"Team","id":$team_id}],"deployment_branch_policy":{"protected_branches":true,"custom_branch_policies":false}}
JSON
  else
    gh api -X PUT "repos/$repo/environments/$1" -f 'deployment_branch_policy[protected_branches]=false' -f 'deployment_branch_policy[custom_branch_policies]=false' >/dev/null
  fi
  echo "environment $1 ready (reviewers: $2)"
}
mk_env staging no
mk_env production yes              # "Required production reviewers approve release"
mk_env production-contract yes     # separately approved DB contract migration
mk_env production-rollback no      # incidents must never wait for an approver
echo "Next: add secrets/variables listed in README.md"
