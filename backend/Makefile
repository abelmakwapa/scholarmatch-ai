PYTHON ?= python3

.PHONY: format format-check lint typecheck test build quality

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

build:
	$(PYTHON) -m compileall -q -f app

quality: format-check lint typecheck test build

