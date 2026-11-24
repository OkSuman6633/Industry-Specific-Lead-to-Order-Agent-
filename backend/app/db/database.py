import sqlite3
from pathlib import Path
from contextlib import contextmanager
from app.core.config import settings

SCHEMA = '''
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, FOREIGN KEY(tenant_id) REFERENCES tenants(id));
CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, channel TEXT NOT NULL, external_ref TEXT, customer_name TEXT NOT NULL, email TEXT, phone TEXT, message TEXT NOT NULL, consent INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'new', urgency TEXT, service_type TEXT, address TEXT, facts_json TEXT NOT NULL DEFAULT '{}', missing_fields_json TEXT NOT NULL DEFAULT '[]', qualification_json TEXT NOT NULL DEFAULT '{}', web_research_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, FOREIGN KEY(tenant_id) REFERENCES tenants(id));
CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_external ON leads(tenant_id, channel, external_ref) WHERE external_ref IS NOT NULL;
CREATE TABLE IF NOT EXISTS lead_messages (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, lead_id TEXT NOT NULL, sender TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(lead_id) REFERENCES leads(id));
CREATE TABLE IF NOT EXISTS idempotency (tenant_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, lead_id TEXT NOT NULL, payload_hash TEXT NOT NULL DEFAULT '', PRIMARY KEY(tenant_id,idempotency_key));
CREATE TABLE IF NOT EXISTS services (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, base_price REAL NOT NULL, vat_rate REAL NOT NULL DEFAULT 20, active INTEGER NOT NULL DEFAULT 1, catalogue_version INTEGER NOT NULL DEFAULT 1, UNIQUE(tenant_id,name));
CREATE TABLE IF NOT EXISTS territories (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, postcode_prefix TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, UNIQUE(tenant_id,postcode_prefix));
CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, lead_id TEXT NOT NULL, catalogue_version INTEGER NOT NULL, line_items_json TEXT NOT NULL, subtotal REAL NOT NULL, vat REAL NOT NULL, total REAL NOT NULL, exclusions_json TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'draft', version INTEGER NOT NULL DEFAULT 1, approved_by TEXT, approved_at TEXT, created_at TEXT NOT NULL, is_vat_exempt INTEGER NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT '', FOREIGN KEY(lead_id) REFERENCES leads(id));
CREATE TABLE IF NOT EXISTS appointments (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, lead_id TEXT NOT NULL, quote_id TEXT NOT NULL, scheduled_time TEXT NOT NULL, timezone TEXT NOT NULL DEFAULT 'Europe/London', technician_name TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'confirmed', created_at TEXT NOT NULL, FOREIGN KEY(lead_id) REFERENCES leads(id), FOREIGN KEY(quote_id) REFERENCES quotes(id));
CREATE TABLE IF NOT EXISTS webhook_events (event_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, provider TEXT NOT NULL, provider_event_id TEXT NOT NULL, payload_hash TEXT NOT NULL, processed_at TEXT NOT NULL, UNIQUE(tenant_id, provider, provider_event_id));
CREATE TABLE IF NOT EXISTS events (event_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, actor_id TEXT, entity_id TEXT NOT NULL, action TEXT NOT NULL, timestamp TEXT NOT NULL, correlation_id TEXT, policy_version TEXT, content_hash TEXT, result TEXT NOT NULL, details_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS settings (tenant_id TEXT NOT NULL, key TEXT NOT NULL, value_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(tenant_id,key));
CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, lead_id TEXT NOT NULL, state TEXT NOT NULL, errors TEXT, trace TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
'''

def init_db():
    path = Path(settings.database_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as conn:
        conn.executescript(SCHEMA)
        
        # Check and migrate columns on users
        cols_users = [row[1] for row in conn.execute("PRAGMA table_info(users)")]
        if "name" not in cols_users:
            conn.execute("ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''")

        # Check and migrate columns on leads
        cols_leads = [row[1] for row in conn.execute("PRAGMA table_info(leads)")]
        if "web_research_json" not in cols_leads:
            conn.execute("ALTER TABLE leads ADD COLUMN web_research_json TEXT NOT NULL DEFAULT '[]'")

        # Check and migrate columns on quotes
        cols_quotes = [row[1] for row in conn.execute("PRAGMA table_info(quotes)")]
        if "is_vat_exempt" not in cols_quotes:
            conn.execute("ALTER TABLE quotes ADD COLUMN is_vat_exempt INTEGER NOT NULL DEFAULT 0")
        if "notes" not in cols_quotes:
            conn.execute("ALTER TABLE quotes ADD COLUMN notes TEXT NOT NULL DEFAULT ''")

        # Check and migrate columns on idempotency
        cols_idempotency = [row[1] for row in conn.execute("PRAGMA table_info(idempotency)")]
        if "payload_hash" not in cols_idempotency:
            conn.execute("ALTER TABLE idempotency ADD COLUMN payload_hash TEXT NOT NULL DEFAULT ''")

        # Check and migrate columns on jobs
        cols_jobs = [row[1] for row in conn.execute("PRAGMA table_info(jobs)")]
        if "trace" not in cols_jobs:
            conn.execute("ALTER TABLE jobs ADD COLUMN trace TEXT")
        if "metadata_json" not in cols_jobs:
            conn.execute("ALTER TABLE jobs ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}'")

        conn.commit()

@contextmanager
def get_db():
    path = Path(settings.database_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=20)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
