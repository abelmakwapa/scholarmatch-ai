PYTHON ?= python3

.PHONY: install run run-ingestion format format-check lint typecheck test test-db build quality

install:
	$(PYTHON) -m pip install -r requirements-dev.txt

run:
	$(PYTHON) -m uvicorn app.main:app --reload --port 8000

run-ingestion:
	@test -n "$(RUN_ID)" || (echo "RUN_ID is required" && exit 2)
	$(PYTHON) -m app.worker --run-id "$(RUN_ID)"

format:
	$(PYTHON) -m ruff format app tests
	$(PYTHON) -m ruff check --fix app tests

format-check:
	$(PYTHON) -m ruff format --check app tests

lint:
	$(PYTHON) -m ruff check app tests

typecheck:
	$(PYTHON) -m mypy app tests

test:
	$(PYTHON) -m pytest -q

test-db:
	@test -n "$(TEST_DATABASE_URL)" || (echo "TEST_DATABASE_URL is required" && exit 2)
	TEST_DATABASE_URL="$(TEST_DATABASE_URL)" $(PYTHON) -m pytest -q -m postgres

build:
	$(PYTHON) -m compileall -q -f app

quality: format-check lint typecheck test build
