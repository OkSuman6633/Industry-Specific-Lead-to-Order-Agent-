import json, uuid
from datetime import datetime, timezone
from app.db.database import get_db
from app.core.security import content_hash

def log_event(tenant_id, entity_id, action, actor_id=None, result="success", details=None, correlation_id=None, policy_version="1.0", db=None):
    raw=json.dumps(details or {}, sort_keys=True, default=str)
    row = (str(uuid.uuid4()),tenant_id,actor_id,entity_id,action,datetime.now(timezone.utc).isoformat(),correlation_id,policy_version,content_hash(raw),result,raw)
    if db is not None:
        db.execute("INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?,?,?)", row)
    else:
        with get_db() as conn:
            conn.execute("INSERT INTO events VALUES (?,?,?,?,?,?,?,?,?,?,?)", row)
