#!/usr/bin/env bash
# "Previous application compatible with current database?"  Prints true|false.
# Expand-only schemas are backward compatible; once the contract migration ran, the old app is not.
source "$(dirname "$0")/lib.sh"
ns=$(ns_for "$1")
[[ "$(state_get "$ns" contract_applied)" == "true" ]] && echo false || echo true
