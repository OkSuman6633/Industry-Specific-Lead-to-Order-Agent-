let cachedBase = '';

export function getToken(): string {
  return localStorage.getItem('bb_token') || '';
}

export function clearToken(): void {
  localStorage.removeItem('bb_token');
}

export async function getBaseUrl(): Promise<string> {
  if (cachedBase) return cachedBase;
  if (import.meta.env.VITE_API_URL) {
    cachedBase = String(import.meta.env.VITE_API_URL);
    return cachedBase;
  }
  
  const host = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
  
  // Probe port 8001 first (where uvicorn is currently running)
  try {
    const res = await fetch(`http://${host}:8001/health`, { method: 'GET', signal: AbortSignal.timeout(800) });
    if (res.ok) {
      cachedBase = `http://${host}:8001/v1`;
      return cachedBase;
    }
  } catch {}

  // Fallback probe port 8000
  try {
    const res = await fetch(`http://${host}:8000/health`, { method: 'GET', signal: AbortSignal.timeout(800) });
    if (res.ok) {
      cachedBase = `http://${host}:8000/v1`;
      return cachedBase;
    }
  } catch {}

  // Default to port 8001
  cachedBase = `http://${host}:8001/v1`;
  return cachedBase;
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const base = await getBaseUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as any || {})
  };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { ...options, headers });
  } catch (err: any) {
    // If request to port 8001 failed, try port 8000 as backup
    if (base.includes(':8001')) {
      const altBase = base.replace(':8001', ':8000');
      try {
        response = await fetch(`${altBase}${path}`, { ...options, headers });
        cachedBase = altBase;
      } catch {
        throw new Error('Unable to connect to backend service. Please check if the backend server is running on port 8001 or 8000.');
      }
    } else {
      throw new Error('Unable to connect to backend service. Please check if the backend server is running.');
    }
  }

  if (!response.ok) {
    let msg = `Request failed (${response.status})`;
    try {
      const errData = await response.json();
      msg = errData.detail || errData.message || msg;
    } catch {}
    
    if (response.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/register')) {
      clearToken();
    }
    throw new Error(msg);
  }

  const type = response.headers.get('content-type') || '';
  if (type.includes('text/csv')) return (await response.text()) as T;
  return response.json();
}
