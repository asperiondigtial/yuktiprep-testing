# Project hooks called by the pipeline. Each placeholder prints a CI warning and succeeds;
# replace the body with your real tooling (npm/pytest/go test/etc.) before relying on the gate.
BASE_URL ?= http://localhost:8080

define PLACEHOLDER
@echo "::warning title=Placeholder target::$(1) is not wired to real tooling yet"
endef

.PHONY: install-locked lint typecheck test-unit test-api test-integration test-contract \
        test-smoke test-e2e test-synthetic check-db-health check-business-journeys check-security-signals

install-locked:             ; $(call PLACEHOLDER,$@)   # e.g. npm ci / pip install --require-hashes / go mod download
lint:                       ; $(call PLACEHOLDER,$@)
typecheck:                  ; $(call PLACEHOLDER,$@)
test-unit:                  ; $(call PLACEHOLDER,$@)
test-api:                   ; $(call PLACEHOLDER,$@)
test-integration:           ; $(call PLACEHOLDER,$@)
test-contract:              ; $(call PLACEHOLDER,$@)
test-smoke:                 ; $(call PLACEHOLDER,$@)   # uses BASE_URL
test-e2e:                   ; $(call PLACEHOLDER,$@)   # staging end-to-end journeys, uses BASE_URL
test-synthetic:             ; $(call PLACEHOLDER,$@)   # production synthetic journeys, read-only, uses BASE_URL
check-db-health:            ; $(call PLACEHOLDER,$@)   # DB + dependency failure signals
check-business-journeys:    ; $(call PLACEHOLDER,$@)   # e.g. login/checkout success rate
check-security-signals:     ; $(call PLACEHOLDER,$@)   # e.g. WAF/auth anomaly alerts
