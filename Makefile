# ---- config ----
DB      ?= hhprevcaredemo
DBUSER  ?= hh_demo_user
API_DIR ?= api
DASHDIR ?= dashboard
VENV    ?= .venv

# ---- utilities ----
.PHONY: help
help:
	@echo "Targets:"
	@echo "  seed              - Load members/labs/immunizations from seeds/"
	@echo "  transform-a1c     - Run the A1C transform SQL"
	@echo "  api-dev           - Start API locally (nodemon/ts-node)"
	@echo "  dashboard-dev     - Start React dev server"
	@echo "  db-psql           - Open psql shell"
	@echo "  migrate-sql       - Run all db/migrations/V*.sql in order"
	@echo "  venv              - Create & activate Python venv + install ETL deps"

# ---- environment ----
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=$(DB)
export DB_USER=$(DBUSER)
export DB_PASSWORD=demopp

# ---- workflows ----
.PHONY: venv
venv:
	python3 -m venv $(VENV); \
	. $(VENV)/bin/activate && pip install -U pip && pip install "psycopg[binary]==3.2.10"

.PHONY: seed
seed:
	. $(VENV)/bin/activate && \
	python etl/load_seed.py --members seeds/members.json && \
	python etl/load_seed.py --labs seeds/labs.json && \
	python etl/load_seed.py --immunizations seeds/immunizations.json

.PHONY: transform-a1c
transform-a1c:
	psql -U $(DBUSER) -d $(DB) -f db/migrations/V002__a1c_transform.sql

.PHONY: api-dev
api-dev:
	cd $(API_DIR) && npm run dev

.PHONY: dashboard-dev
dashboard-dev:
	cd $(DASHDIR) && npm start

.PHONY: db-psql
db-psql:
	psql -U $(DBUSER) -d $(DB)

.PHONY: migrate-sql
migrate-sql:
	@for f in $$(ls db/migrations/V*.sql | sort); do \
	  echo ">> $$f"; \
	  psql -U $(DBUSER) -d $(DB) -f $$f || exit 1; \
	done
