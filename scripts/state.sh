#!/usr/bin/env bash
# Usage: state.sh <env> get <key> | state.sh <env> set k=v [k=v...]
source "$(dirname "$0")/lib.sh"
ns=$(ns_for "$1"); shift
case "$1" in get) state_get "$ns" "$2" ;; set) shift; state_set "$ns" "$@" ;; *) die "usage" ;; esac
