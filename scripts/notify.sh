#!/usr/bin/env bash
# Usage: notify.sh "message"   (set SLACK_WEBHOOK_URL to enable; otherwise prints)
msg="${1:?message}"
echo "NOTIFY: $msg"
[[ -n "${SLACK_WEBHOOK_URL:-}" ]] && curl -fsS -X POST -H 'Content-type: application/json' --data "$(jq -nc --arg t "$msg" '{text:$t}')" "$SLACK_WEBHOOK_URL" >/dev/null || true
