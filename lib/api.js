/* =================================================================
   DagzFlix - API Layer with Client-Side Cache
   ================================================================= */

const apiCache = new Map();

const CACHE_TTLS = {
  'setup/check': 120000,
  'auth/session': 60000,
  'media/library': 300000,
  'media/detail': 600000,
  'media/seasons': 600000,
  'media/episodes': 600000,
  'media/trailer': 3600000,
  'media/collection': 3600000,
  'media/status': 60000,
  'media/resume': 300000,
  'search': 120000,
  'discover': 300000,
  'recommendations': 300000,
  'wizard': 120000,
};

function getCacheTTL(path) {
  for (const [key, ttl] of Object.entries(CACHE_TTLS)) {
    if (path.startsWith(key)) return ttl;
  }
  return 60000;
}

export async function api(path, options = {}) {
  const res = await fetch(`/api/${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  return res.json();
}

export async function cachedApi(path, options = {}) {
  const isGet = !options.method || options.method === 'GET';
  if (isGet) {
    const cached = apiCache.get(path);
    if (cached && Date.now() - cached.ts < getCacheTTL(path)) return cached.data;
  }
  const data = await api(path, options);
  if (isGet) apiCache.set(path, { data, ts: Date.now() });
  return data;
}

export function invalidateCache(prefix) {
  for (const key of apiCache.keys()) {
    if (key.startsWith(prefix)) apiCache.delete(key);
  }
}

export function clearCache() {
  apiCache.clear();
}
