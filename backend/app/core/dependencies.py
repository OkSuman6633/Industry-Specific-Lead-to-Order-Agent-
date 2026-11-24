from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import decode_token
from app.db.database import get_db
security = HTTPBearer(auto_error=False)

def current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials: raise HTTPException(401, "Authentication required")
    try: return decode_token(credentials.credentials)
    except Exception: raise HTTPException(401, "Invalid or expired token")

def require_roles(*roles):
    def checker(user=Depends(current_user)):
        if user["role"] not in roles: raise HTTPException(403, "Your role cannot perform this action")
        return user
    return checker
