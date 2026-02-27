import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

/* =================================================================
   DagzFlix Backend - BFF (Backend-For-Frontend)
   All requests to Jellyfin/Jellyseerr are proxied through these routes.
   No client-side code ever talks directly to external servers.
   ================================================================= */

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || 'dagzflix';

// --- MongoDB Connection Singleton ---
let cachedClient = null;
let cachedDb = null;

async function getDb() {
  if (cachedDb) return cachedDb;
  try {
    if (!cachedClient) {
      cachedClient = new MongoClient(MONGO_URL);
      await cachedClient.connect();
    }
    cachedDb = cachedClient.db(DB_NAME);
    return cachedDb;
  } catch (err) {
    console.error('[DagzFlix] MongoDB connection error:', err.message);
    throw new Error('Database connection failed');
  }
}

// --- Helper: JSON response with CORS ---
function jsonResponse(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// --- Helper: Get session from cookie ---
async function getSession(req) {
  const sessionId = req.cookies.get('dagzflix_session')?.value;
  if (!sessionId) return null;
  const db = await getDb();
  const session = await db.collection('sessions').findOne({ _id: sessionId });
  if (!session) return null;
  if (new Date(session.expiresAt) < new Date()) {
    await db.collection('sessions').deleteOne({ _id: sessionId });
    return null;
  }
  return session;
}

// --- Helper: Get server configuration ---
async function getConfig() {
  const db = await getDb();
  return db.collection('config').findOne({ _id: 'main' });
}

// --- Helper: Build Jellyfin auth header ---
function jellyfinAuthHeader(token) {
  const base = 'MediaBrowser Client="DagzFlix", Device="Web", DeviceId="dagzflix-web", Version="1.0"';
  return token ? `${base}, Token="${token}"` : base;
}

/* =================================================================
   SETUP ROUTES
   ================================================================= */

/** Check if initial setup has been completed */
async function handleSetupCheck() {
  try {
    const config = await getConfig();
    return jsonResponse({
      setupComplete: !!config?.setupComplete,
      jellyfinConfigured: !!config?.jellyfinUrl,
      jellyseerrConfigured: !!config?.jellyseerrUrl,
    });
  } catch (err) {
    return jsonResponse({ setupComplete: false, error: err.message });
  }
}

/** Test connection to Jellyfin or Jellyseerr */
async function handleSetupTest(req) {
  try {
    const body = await req.json();
    const { type, url, apiKey } = body;

    if (!type || !url) {
      return jsonResponse({ success: false, error: 'Type et URL requis' }, 400);
    }

    if (type === 'jellyfin') {
      const res = await fetch(`${url}/System/Info/Public`, {
        headers: { 'X-Emby-Token': apiKey || '' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`Jellyfin responded with ${res.status}`);
      const data = await res.json();
      return jsonResponse({
        success: true,
        serverName: data.ServerName,
        version: data.Version,
      });
    }

    if (type === 'jellyseerr') {
      const res = await fetch(`${url}/api/v1/status`, {
        headers: { 'X-Api-Key': apiKey || '' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`Jellyseerr responded with ${res.status}`);
      const data = await res.json();
      return jsonResponse({
        success: true,
        version: data.version,
      });
    }

    return jsonResponse({ success: false, error: 'Type invalide' }, 400);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

/** Save setup configuration */
async function handleSetupSave(req) {
  try {
    const body = await req.json();
    const { jellyfinUrl, jellyfinApiKey, jellyseerrUrl, jellyseerrApiKey } = body;

    if (!jellyfinUrl) {
      return jsonResponse({ success: false, error: 'URL Jellyfin requise' }, 400);
    }

    const db = await getDb();
    await db.collection('config').updateOne(
      { _id: 'main' },
      {
        $set: {
          jellyfinUrl: jellyfinUrl.replace(/\/$/, ''),
          jellyfinApiKey: jellyfinApiKey || '',
          jellyseerrUrl: (jellyseerrUrl || '').replace(/\/$/, ''),
          jellyseerrApiKey: jellyseerrApiKey || '',
          setupComplete: true,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return jsonResponse({ success: true, message: 'Configuration sauvegardee' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

/* =================================================================
   AUTH ROUTES
   ================================================================= */

/** Login via Jellyfin proxy - authenticate user and create local session */
async function handleAuthLogin(req) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return jsonResponse({ success: false, error: 'Identifiants requis' }, 400);
    }

    const config = await getConfig();
    if (!config?.jellyfinUrl) {
      return jsonResponse({ success: false, error: 'Serveur non configure' }, 400);
    }

    // Proxy authentication to Jellyfin
    const jellyfinRes = await fetch(`${config.jellyfinUrl}/Users/AuthenticateByName`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization': jellyfinAuthHeader(),
      },
      body: JSON.stringify({ Username: username, Pw: password }),
      signal: AbortSignal.timeout(15000),
    });

    if (!jellyfinRes.ok) {
      const status = jellyfinRes.status;
      if (status === 401) return jsonResponse({ success: false, error: 'Identifiants incorrects' }, 401);
      throw new Error(`Jellyfin auth failed with status ${status}`);
    }

    const authData = await jellyfinRes.json();
    const userId = authData.User?.Id;
    const accessToken = authData.AccessToken;
    const displayName = authData.User?.Name || username;

    // Create local session
    const sessionId = uuidv4();
    const db = await getDb();
    await db.collection('sessions').insertOne({
      _id: sessionId,
      userId,
      jellyfinToken: accessToken,
      jellyfinUserId: userId,
      username: displayName,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Check if onboarding is complete
    const prefs = await db.collection('preferences').findOne({ userId });

    const response = jsonResponse({
      success: true,
      user: { id: userId, name: displayName },
      onboardingComplete: !!prefs?.onboardingComplete,
    });

    // Set httpOnly session cookie
    response.cookies.set('dagzflix_session', sessionId, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('[DagzFlix] Auth error:', err.message);
    return jsonResponse({
      success: false,
      error: 'Impossible de se connecter au serveur de streaming: ' + err.message,
    }, 500);
  }
}

/** Logout - destroy session */
async function handleAuthLogout(req) {
  try {
    const sessionId = req.cookies.get('dagzflix_session')?.value;
    if (sessionId) {
      const db = await getDb();
      await db.collection('sessions').deleteOne({ _id: sessionId });
    }
    const response = jsonResponse({ success: true });
    response.cookies.set('dagzflix_session', '', { maxAge: 0, path: '/' });
    return response;
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

/** Get current session info */
async function handleAuthSession(req) {
  try {
    const session = await getSession(req);
    if (!session) {
      return jsonResponse({ authenticated: false });
    }
    const db = await getDb();
    const prefs = await db.collection('preferences').findOne({ userId: session.userId });
    return jsonResponse({
      authenticated: true,
      user: {
        id: session.userId,
        name: session.username,
        jellyfinUserId: session.jellyfinUserId,
      },
      onboardingComplete: !!prefs?.onboardingComplete,
    });
  } catch (err) {
    return jsonResponse({ authenticated: false, error: err.message });
  }
}

/* =================================================================
   PREFERENCES & ONBOARDING ROUTES
   ================================================================= */

/** Save user genre preferences (onboarding) */
async function handlePreferencesSave(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);

    const body = await req.json();
    const { favoriteGenres, dislikedGenres } = body;

    const db = await getDb();
    await db.collection('preferences').updateOne(
      { userId: session.userId },
      {
        $set: {
          userId: session.userId,
          favoriteGenres: favoriteGenres || [],
          dislikedGenres: dislikedGenres || [],
          onboardingComplete: true,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

/** Get user preferences */
async function handlePreferencesGet(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);

    const db = await getDb();
    const prefs = await db.collection('preferences').findOne({ userId: session.userId });
    return jsonResponse({ preferences: prefs || {} });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

/* =================================================================
   MEDIA ROUTES - Jellyfin Proxy
   ================================================================= */

/** Get media library from Jellyfin */
async function handleMediaLibrary(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);

    const config = await getConfig();
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'Movie';
    const limit = url.searchParams.get('limit') || '20';
    const startIndex = url.searchParams.get('startIndex') || '0';
    const sortBy = url.searchParams.get('sortBy') || 'DateCreated';
    const sortOrder = url.searchParams.get('sortOrder') || 'Descending';
    const genreIds = url.searchParams.get('genreIds') || '';
    const searchTerm = url.searchParams.get('searchTerm') || '';

    let endpoint = `${config.jellyfinUrl}/Users/${session.jellyfinUserId}/Items`;
    const params = new URLSearchParams({
      IncludeItemTypes: type,
      Limit: limit,
      StartIndex: startIndex,
      SortBy: sortBy,
      SortOrder: sortOrder,
      Recursive: 'true',
      Fields: 'Overview,Genres,CommunityRating,OfficialRating,PremiereDate,RunTimeTicks,People,ProviderIds,MediaSources',
      ImageTypeLimit: '1',
      EnableImageTypes: 'Primary,Backdrop,Thumb',
    });

    if (genreIds) params.set('GenreIds', genreIds);
    if (searchTerm) params.set('SearchTerm', searchTerm);

    const res = await fetch(`${endpoint}?${params.toString()}`, {
      headers: { 'X-Emby-Token': session.jellyfinToken },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`Jellyfin responded with ${res.status}`);
    const data = await res.json();

    // Transform items to include proxy image URLs
    const items = (data.Items || []).map(item => ({
      id: item.Id,
      name: item.Name,
      type: item.Type,
      overview: item.Overview || '',
      genres: item.Genres || [],
      communityRating: item.CommunityRating || 0,
      officialRating: item.OfficialRating || '',
      premiereDate: item.PremiereDate || '',
      year: item.ProductionYear || '',
      runtime: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : 0,
      posterUrl: `/api/proxy/image?itemId=${item.Id}&type=Primary&maxWidth=400`,
      backdropUrl: `/api/proxy/image?itemId=${item.Id}&type=Backdrop&maxWidth=1920`,
      thumbUrl: `/api/proxy/image?itemId=${item.Id}&type=Thumb&maxWidth=600`,
      people: (item.People || []).slice(0, 5).map(p => ({ name: p.Name, role: p.Role, type: p.Type })),
      providerIds: item.ProviderIds || {},
      hasSubtitles: item.HasSubtitles || false,
      isPlayed: item.UserData?.Played || false,
      playbackPositionTicks: item.UserData?.PlaybackPositionTicks || 0,
      mediaSources: (item.MediaSources || []).length > 0,
    }));

    return jsonResponse({
      items,
      totalCount: data.TotalRecordCount || 0,
    });
  } catch (err) {
    console.error('[DagzFlix] Media library error:', err.message);
    return jsonResponse({ items: [], totalCount: 0, error: err.message }, 500);
  }
}

/** Get Jellyfin genres */
async function handleMediaGenres(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);

    const config = await getConfig();
    const res = await fetch(
      `${config.jellyfinUrl}/Genres?UserId=${session.jellyfinUserId}&SortBy=SortName&SortOrder=Ascending`,
      {
        headers: { 'X-Emby-Token': session.jellyfinToken },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) throw new Error(`Jellyfin responded with ${res.status}`);
    const data = await res.json();
    const genres = (data.Items || []).map(g => ({ id: g.Id, name: g.Name }));
    return jsonResponse({ genres });
  } catch (err) {
    return jsonResponse({ genres: [], error: err.message }, 500);
  }
}

/** Get single media detail from Jellyfin */
async function handleMediaDetail(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);

    const config = await getConfig();
    const url = new URL(req.url);
    const itemId = url.searchParams.get('id');

    if (!itemId) return jsonResponse({ error: 'ID requis' }, 400);

    const res = await fetch(
      `${config.jellyfinUrl}/Users/${session.jellyfinUserId}/Items/${itemId}`,
      {
        headers: { 'X-Emby-Token': session.jellyfinToken },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) throw new Error(`Jellyfin responded with ${res.status}`);
    const item = await res.json();

    // Get similar items
    let similar = [];
    try {
      const simRes = await fetch(
        `${config.jellyfinUrl}/Items/${itemId}/Similar?UserId=${session.jellyfinUserId}&Limit=12&Fields=Overview,Genres,CommunityRating`,
        { headers: { 'X-Emby-Token': session.jellyfinToken }, signal: AbortSignal.timeout(10000) }
      );
      if (simRes.ok) {
        const simData = await simRes.json();
        similar = (simData.Items || []).map(s => ({
          id: s.Id, name: s.Name, type: s.Type,
          posterUrl: `/api/proxy/image?itemId=${s.Id}&type=Primary&maxWidth=300`,
          communityRating: s.CommunityRating || 0,
          year: s.ProductionYear || '',
        }));
      }
    } catch (e) { /* ignore similar items errors */ }

    return jsonResponse({
      item: {
        id: item.Id,
        name: item.Name,
        originalTitle: item.OriginalTitle || '',
        type: item.Type,
        overview: item.Overview || '',
        genres: item.Genres || [],
        communityRating: item.CommunityRating || 0,
        officialRating: item.OfficialRating || '',
        premiereDate: item.PremiereDate || '',
        year: item.ProductionYear || '',
        runtime: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : 0,
        posterUrl: `/api/proxy/image?itemId=${item.Id}&type=Primary&maxWidth=500`,
        backdropUrl: `/api/proxy/image?itemId=${item.Id}&type=Backdrop&maxWidth=1920`,
        people: (item.People || []).map(p => ({ name: p.Name, role: p.Role, type: p.Type })),
        providerIds: item.ProviderIds || {},
        studios: (item.Studios || []).map(s => s.Name),
        taglines: item.Taglines || [],
        isPlayed: item.UserData?.Played || false,
        playbackPositionTicks: item.UserData?.PlaybackPositionTicks || 0,
        mediaSources: (item.MediaSources || []).map(ms => ({
          id: ms.Id, name: ms.Name, size: ms.Size,
          container: ms.Container, videoCodec: ms.VideoStream?.Codec,
          audioCodec: ms.AudioStream?.Codec,
          resolution: ms.VideoStream ? `${ms.VideoStream.Width}x${ms.VideoStream.Height}` : '',
        })),
        hasSubtitles: item.HasSubtitles || false,
        externalUrls: item.ExternalUrls || [],
      },
      similar,
    });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

/* =================================================================
   SMART BUTTON - Unified status check
   Checks both Jellyfin (availability) and Jellyseerr (request status)
   ================================================================= */

async function handleMediaStatus(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);

    const config = await getConfig();
    const url = new URL(req.url);
    const itemId = url.searchParams.get('id');
    const tmdbId = url.searchParams.get('tmdbId');
    const mediaType = url.searchParams.get('mediaType') || 'movie';

    let status = 'unknown';
    let jellyfinAvailable = false;
    let jellyseerrStatus = null;

    // Check Jellyfin availability
    if (itemId) {
      try {
        const res = await fetch(
          `${config.jellyfinUrl}/Users/${session.jellyfinUserId}/Items/${itemId}`,
          { headers: { 'X-Emby-Token': session.jellyfinToken }, signal: AbortSignal.timeout(8000) }
        );
        if (res.ok) {
          const item = await res.json();
          jellyfinAvailable = (item.MediaSources || []).length > 0;
        }
      } catch (e) { /* Jellyfin unreachable */ }
    }

    // Check Jellyseerr status if TMDB ID is available
    if (tmdbId && config.jellyseerrUrl) {
      try {
        const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
        const res = await fetch(
          `${config.jellyseerrUrl}/api/v1/${endpoint}/${tmdbId}`,
          { headers: { 'X-Api-Key': config.jellyseerrApiKey }, signal: AbortSignal.timeout(8000) }
        );
        if (res.ok) {
          const data = await res.json();
          jellyseerrStatus = data.mediaInfo?.status || null;
        }
      } catch (e) { /* Jellyseerr unreachable */ }
    }

    // Determine Smart Button status
    if (jellyfinAvailable) {
      status = 'available'; // -> Play button
    } else if (jellyseerrStatus === 2 || jellyseerrStatus === 3) {
      status = 'pending'; // -> "En cours d'acquisition"
    } else if (jellyseerrStatus === 4) {
      status = 'partial'; // -> Partially available
    } else if (jellyseerrStatus === 5) {
      status = 'available'; // Available via Jellyseerr
    } else {
      status = 'not_available'; // -> Request button
    }

    return jsonResponse({ status, jellyfinAvailable, jellyseerrStatus });
  } catch (err) {
    return jsonResponse({ status: 'unknown', error: err.message }, 500);
  }
}

/** Request media via Jellyseerr */
async function handleMediaRequest(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);

    const config = await getConfig();
    if (!config.jellyseerrUrl) {
      return jsonResponse({ error: 'Jellyseerr non configure' }, 400);
    }

    const body = await req.json();
    const { tmdbId, mediaType, seasons } = body;

    if (!tmdbId) return jsonResponse({ error: 'TMDB ID requis' }, 400);

    const requestBody = {
      mediaType: mediaType || 'movie',
      mediaId: parseInt(tmdbId),
    };
    if (mediaType === 'tv' && seasons) {
      requestBody.seasons = seasons;
    }

    const res = await fetch(`${config.jellyseerrUrl}/api/v1/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.jellyseerrApiKey,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Jellyseerr responded with ${res.status}`);
    }

    const data = await res.json();
    return jsonResponse({ success: true, request: data });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}

/* =================================================================
   SEARCH ROUTES - Jellyseerr/TMDB Proxy
   ================================================================= */

async function handleSearch(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);

    const config = await getConfig();
    const url = new URL(req.url);
    const query = url.searchParams.get('q') || '';
    const page = url.searchParams.get('page') || '1';

    if (!query.trim()) return jsonResponse({ results: [] });

    // Try Jellyseerr first for TMDB search
    if (config.jellyseerrUrl) {
      try {
        const res = await fetch(
          `${config.jellyseerrUrl}/api/v1/search?query=${encodeURIComponent(query)}&page=${page}`,
          { headers: { 'X-Api-Key': config.jellyseerrApiKey }, signal: AbortSignal.timeout(10000) }
        );
        if (res.ok) {
          const data = await res.json();
          const results = (data.results || []).map(item => ({
            id: item.id,
            tmdbId: item.id,
            name: item.title || item.name || '',
            type: item.mediaType === 'tv' ? 'Series' : 'Movie',
            mediaType: item.mediaType,
            overview: item.overview || '',
            posterUrl: item.posterPath ? `/api/proxy/tmdb?path=${item.posterPath}&width=w400` : '',
            backdropUrl: item.backdropPath ? `/api/proxy/tmdb?path=${item.backdropPath}&width=w1280` : '',
            year: (item.releaseDate || item.firstAirDate || '').substring(0, 4),
            voteAverage: item.voteAverage || 0,
            mediaStatus: item.mediaInfo?.status || 0,
          }));
          return jsonResponse({ results, totalPages: data.totalPages || 1, totalResults: data.totalResults || 0 });
        }
      } catch (e) { /* Jellyseerr search failed, fallback to Jellyfin */ }
    }

    // Fallback: search Jellyfin directly
    const res = await fetch(
      `${config.jellyfinUrl}/Users/${session.jellyfinUserId}/Items?SearchTerm=${encodeURIComponent(query)}&Recursive=true&Limit=20&Fields=Overview,Genres,CommunityRating,ProviderIds`,
      { headers: { 'X-Emby-Token': session.jellyfinToken }, signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    const results = (data.Items || []).map(item => ({
      id: item.Id,
      name: item.Name,
      type: item.Type,
      overview: item.Overview || '',
      posterUrl: `/api/proxy/image?itemId=${item.Id}&type=Primary&maxWidth=300`,
      year: item.ProductionYear || '',
      communityRating: item.CommunityRating || 0,
      mediaStatus: 5, // Available in Jellyfin
    }));

    return jsonResponse({ results, totalResults: data.TotalRecordCount || 0 });
  } catch (err) {
    return jsonResponse({ results: [], error: err.message }, 500);
  }
}

/* =================================================================
   JELLYSEERR DISCOVER - Trending content
   ================================================================= */

async function handleDiscover(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);

    const config = await getConfig();
    const url = new URL(req.url);
    const type = url.searchParams.get('type') || 'movies';
    const page = url.searchParams.get('page') || '1';

    if (!config.jellyseerrUrl) {
      return jsonResponse({ results: [], error: 'Jellyseerr non configure' });
    }

    const endpoint = type === 'tv' ? 'tv' : 'movies';
    const res = await fetch(
      `${config.jellyseerrUrl}/api/v1/discover/${endpoint}?page=${page}`,
      { headers: { 'X-Api-Key': config.jellyseerrApiKey }, signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) throw new Error(`Discover failed: ${res.status}`);
    const data = await res.json();

    const results = (data.results || []).map(item => ({
      id: item.id,
      tmdbId: item.id,
      name: item.title || item.name || '',
      type: type === 'tv' ? 'Series' : 'Movie',
      mediaType: type === 'tv' ? 'tv' : 'movie',
      overview: item.overview || '',
      posterUrl: item.posterPath ? `/api/proxy/tmdb?path=${item.posterPath}&width=w400` : '',
      backdropUrl: item.backdropPath ? `/api/proxy/tmdb?path=${item.backdropPath}&width=w1280` : '',
      year: (item.releaseDate || item.firstAirDate || '').substring(0, 4),
      voteAverage: item.voteAverage || 0,
      genreIds: item.genreIds || [],
      mediaStatus: item.mediaInfo?.status || 0,
    }));

    return jsonResponse({ results, totalPages: data.totalPages || 1 });
  } catch (err) {
    return jsonResponse({ results: [], error: err.message }, 500);
  }
}

/* =================================================================
   DAGZRANK - Recommendation Algorithm
   
   Scoring system (0-100 per media):
   - Genre Match (0-40pts): Based on user's favorite/disliked genres
   - Watch History Affinity (0-25pts): Genres/patterns from viewing history
   - Community Score (0-20pts): TMDB rating normalized
   - Freshness Bonus (0-10pts): Recent content gets bonus
   - Already Watched Penalty: -100 (excluded)
   ================================================================= */

/** Calculate DagzRank score for a single media item */
function calculateDagzRank(item, preferences, watchHistory) {
  let score = 0;
  const itemGenres = item.genres || item.Genres || [];
  const favGenres = preferences?.favoriteGenres || [];
  const dislikedGenres = preferences?.dislikedGenres || [];

  // 1. Genre Match Score (0-40)
  if (itemGenres.length > 0 && favGenres.length > 0) {
    const matchCount = itemGenres.filter(g => favGenres.includes(g)).length;
    const dislikeCount = itemGenres.filter(g => dislikedGenres.includes(g)).length;
    const genreScore = (matchCount / Math.max(itemGenres.length, 1)) * 40;
    const dislikePenalty = (dislikeCount / Math.max(itemGenres.length, 1)) * 20;
    score += Math.max(0, genreScore - dislikePenalty);
  } else {
    score += 15; // Default score for items with no genre data
  }

  // 2. Watch History Affinity (0-25)
  if (watchHistory && watchHistory.length > 0) {
    const historyGenres = {};
    watchHistory.forEach(h => {
      (h.genres || []).forEach(g => {
        historyGenres[g] = (historyGenres[g] || 0) + 1;
      });
    });
    const maxCount = Math.max(...Object.values(historyGenres), 1);
    let affinityScore = 0;
    itemGenres.forEach(g => {
      if (historyGenres[g]) {
        affinityScore += (historyGenres[g] / maxCount) * 25;
      }
    });
    score += Math.min(25, affinityScore / Math.max(itemGenres.length, 1) * itemGenres.length);
  } else {
    score += 10; // Default for new users
  }

  // 3. Community Score (0-20)
  const rating = item.communityRating || item.CommunityRating || item.voteAverage || 0;
  score += (rating / 10) * 20;

  // 4. Freshness Bonus (0-10)
  const year = item.year || item.ProductionYear || 0;
  const currentYear = new Date().getFullYear();
  if (year) {
    const age = currentYear - parseInt(year);
    if (age <= 1) score += 10;
    else if (age <= 3) score += 7;
    else if (age <= 5) score += 4;
    else if (age <= 10) score += 2;
  }

  // 5. Already Watched Penalty
  if (item.isPlayed) {
    score = Math.max(0, score - 50);
  }

  return Math.min(100, Math.round(score));
}

/** Get DagzRank recommendations */
async function handleRecommendations(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);

    const config = await getConfig();
    const db = await getDb();
    const prefs = await db.collection('preferences').findOne({ userId: session.userId });

    // Get user's watch history from Jellyfin
    let watchHistory = [];
    try {
      const histRes = await fetch(
        `${config.jellyfinUrl}/Users/${session.jellyfinUserId}/Items?IsPlayed=true&Recursive=true&Limit=100&Fields=Genres&SortBy=DatePlayed&SortOrder=Descending`,
        { headers: { 'X-Emby-Token': session.jellyfinToken }, signal: AbortSignal.timeout(10000) }
      );
      if (histRes.ok) {
        const histData = await histRes.json();
        watchHistory = (histData.Items || []).map(i => ({
          id: i.Id, name: i.Name, genres: i.Genres || [],
        }));
      }
    } catch (e) { /* history fetch failed */ }

    // Get available media from Jellyfin
    const mediaRes = await fetch(
      `${config.jellyfinUrl}/Users/${session.jellyfinUserId}/Items?Recursive=true&Limit=100&IncludeItemTypes=Movie,Series&Fields=Overview,Genres,CommunityRating,PremiereDate&SortBy=Random`,
      { headers: { 'X-Emby-Token': session.jellyfinToken }, signal: AbortSignal.timeout(15000) }
    );

    if (!mediaRes.ok) throw new Error('Failed to fetch media library');
    const mediaData = await mediaRes.json();

    // Score each item with DagzRank
    const scored = (mediaData.Items || []).map(item => {
      const score = calculateDagzRank(item, prefs, watchHistory);
      return {
        id: item.Id,
        name: item.Name,
        type: item.Type,
        overview: item.Overview || '',
        genres: item.Genres || [],
        communityRating: item.CommunityRating || 0,
        year: item.ProductionYear || '',
        posterUrl: `/api/proxy/image?itemId=${item.Id}&type=Primary&maxWidth=400`,
        backdropUrl: `/api/proxy/image?itemId=${item.Id}&type=Backdrop&maxWidth=1920`,
        isPlayed: item.UserData?.Played || false,
        dagzRank: score,
      };
    });

    // Sort by DagzRank descending
    scored.sort((a, b) => b.dagzRank - a.dagzRank);

    return jsonResponse({
      recommendations: scored.filter(s => s.dagzRank > 20).slice(0, 30),
      totalScored: scored.length,
    });
  } catch (err) {
    console.error('[DagzFlix] Recommendations error:', err.message);
    return jsonResponse({ recommendations: [], error: err.message }, 500);
  }
}

/* =================================================================
   PROXY ROUTES - Secure image/video proxying
   No external URLs are ever exposed to the client
   ================================================================= */

/** Proxy Jellyfin images */
async function handleProxyImage(req) {
  try {
    const config = await getConfig();
    if (!config?.jellyfinUrl) return new Response('Not configured', { status: 503 });

    const url = new URL(req.url);
    const itemId = url.searchParams.get('itemId');
    const type = url.searchParams.get('type') || 'Primary';
    const maxWidth = url.searchParams.get('maxWidth') || '400';

    if (!itemId) return new Response('Missing itemId', { status: 400 });

    const imageUrl = `${config.jellyfinUrl}/Items/${itemId}/Images/${type}?maxWidth=${maxWidth}`;
    const res = await fetch(imageUrl, {
      headers: config.jellyfinApiKey ? { 'X-Emby-Token': config.jellyfinApiKey } : {},
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return new Response('Image not found', { status: 404 });
    }

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response('Proxy error', { status: 500 });
  }
}

/** Proxy TMDB images (from Jellyseerr search results) */
async function handleProxyTmdb(req) {
  try {
    const url = new URL(req.url);
    const path = url.searchParams.get('path');
    const width = url.searchParams.get('width') || 'w400';

    if (!path) return new Response('Missing path', { status: 400 });

    const imageUrl = `https://image.tmdb.org/t/p/${width}${path}`;
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });

    if (!res.ok) return new Response('Image not found', { status: 404 });

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response('Proxy error', { status: 500 });
  }
}

/** Get streaming URL (returns proxy URL for the video player) */
async function handleStream(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);

    const config = await getConfig();
    const url = new URL(req.url);
    const itemId = url.searchParams.get('id');

    if (!itemId) return jsonResponse({ error: 'ID requis' }, 400);

    // Get playback info from Jellyfin
    const res = await fetch(
      `${config.jellyfinUrl}/Items/${itemId}/PlaybackInfo?UserId=${session.jellyfinUserId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Emby-Token': session.jellyfinToken,
        },
        body: JSON.stringify({
          DeviceProfile: {
            MaxStreamingBitrate: 40000000,
            MaxStaticBitrate: 40000000,
            DirectPlayProfiles: [
              { Container: 'mp4,m4v', Type: 'Video', VideoCodec: 'h264,hevc', AudioCodec: 'aac,mp3,ac3' },
              { Container: 'mkv', Type: 'Video', VideoCodec: 'h264,hevc', AudioCodec: 'aac,mp3,ac3' },
            ],
            TranscodingProfiles: [
              { Container: 'mp4', Type: 'Video', VideoCodec: 'h264', AudioCodec: 'aac', Protocol: 'hls' },
            ],
          },
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) throw new Error('Playback info failed');
    const playbackInfo = await res.json();

    const mediaSources = playbackInfo.MediaSources || [];
    const playSessionId = playbackInfo.PlaySessionId;

    // Build streaming URL
    const streamUrl = `/api/proxy/stream?id=${itemId}&mediaSourceId=${mediaSources[0]?.Id || ''}&playSessionId=${playSessionId || ''}`;

    return jsonResponse({
      streamUrl,
      mediaSources: mediaSources.map(ms => ({
        id: ms.Id,
        name: ms.Name,
        directPlay: ms.SupportsDirectPlay,
        directStream: ms.SupportsDirectStream,
        transcoding: ms.SupportsTranscoding,
        container: ms.Container,
      })),
      playSessionId,
    });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

/** Proxy actual video stream from Jellyfin */
async function handleProxyStream(req) {
  try {
    const session = await getSession(req);
    if (!session) return new Response('Unauthorized', { status: 401 });

    const config = await getConfig();
    const url = new URL(req.url);
    const itemId = url.searchParams.get('id');
    const mediaSourceId = url.searchParams.get('mediaSourceId') || '';
    const playSessionId = url.searchParams.get('playSessionId') || '';

    if (!itemId) return new Response('Missing ID', { status: 400 });

    const streamUrl = `${config.jellyfinUrl}/Videos/${itemId}/stream?Static=true&mediaSourceId=${mediaSourceId}&PlaySessionId=${playSessionId}&api_key=${session.jellyfinToken}`;

    const res = await fetch(streamUrl, { signal: AbortSignal.timeout(30000) });

    if (!res.ok) return new Response('Stream error', { status: res.status });

    return new Response(res.body, {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('content-type') || 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response('Stream proxy error', { status: 500 });
  }
}

/* =================================================================
   SERIES - Seasons & Episodes from Jellyfin
   ================================================================= */

/** Get all seasons for a series */
async function handleMediaSeasons(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);
    const config = await getConfig();
    const url = new URL(req.url);
    const seriesId = url.searchParams.get('seriesId');
    if (!seriesId) return jsonResponse({ error: 'seriesId requis' }, 400);

    const res = await fetch(
      `${config.jellyfinUrl}/Shows/${seriesId}/Seasons?UserId=${session.jellyfinUserId}&Fields=Overview,ItemCounts`,
      { headers: { 'X-Emby-Token': session.jellyfinToken }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) throw new Error(`Jellyfin ${res.status}`);
    const data = await res.json();
    const seasons = (data.Items || []).map(s => ({
      id: s.Id,
      name: s.Name,
      seasonNumber: s.IndexNumber || 0,
      episodeCount: s.ChildCount || 0,
      overview: s.Overview || '',
      posterUrl: `/api/proxy/image?itemId=${s.Id}&type=Primary&maxWidth=400`,
      premiereDate: s.PremiereDate || '',
      year: s.ProductionYear || '',
    }));
    return jsonResponse({ seasons });
  } catch (err) {
    return jsonResponse({ seasons: [], error: err.message }, 500);
  }
}

/** Get episodes for a specific season */
async function handleMediaEpisodes(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);
    const config = await getConfig();
    const url = new URL(req.url);
    const seriesId = url.searchParams.get('seriesId');
    const seasonId = url.searchParams.get('seasonId');
    if (!seriesId) return jsonResponse({ error: 'seriesId requis' }, 400);

    let endpoint = `${config.jellyfinUrl}/Shows/${seriesId}/Episodes?UserId=${session.jellyfinUserId}&Fields=Overview,MediaSources,RunTimeTicks`;
    if (seasonId) endpoint += `&SeasonId=${seasonId}`;

    const res = await fetch(endpoint, {
      headers: { 'X-Emby-Token': session.jellyfinToken },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Jellyfin ${res.status}`);
    const data = await res.json();

    const episodes = (data.Items || []).map(ep => ({
      id: ep.Id,
      name: ep.Name,
      episodeNumber: ep.IndexNumber || 0,
      seasonNumber: ep.ParentIndexNumber || 0,
      overview: ep.Overview || '',
      runtime: ep.RunTimeTicks ? Math.round(ep.RunTimeTicks / 600000000) : 0,
      thumbUrl: `/api/proxy/image?itemId=${ep.Id}&type=Primary&maxWidth=400`,
      backdropUrl: `/api/proxy/image?itemId=${ep.Id}&type=Backdrop&maxWidth=800`,
      isPlayed: ep.UserData?.Played || false,
      playbackPositionTicks: ep.UserData?.PlaybackPositionTicks || 0,
      communityRating: ep.CommunityRating || 0,
      premiereDate: ep.PremiereDate || '',
      hasMediaSources: (ep.MediaSources || []).length > 0,
    }));

    return jsonResponse({ episodes });
  } catch (err) {
    return jsonResponse({ episodes: [], error: err.message }, 500);
  }
}

/* =================================================================
   TRAILERS - From Jellyfin RemoteTrailers or TMDB
   ================================================================= */

async function handleMediaTrailer(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);
    const config = await getConfig();
    const url = new URL(req.url);
    const itemId = url.searchParams.get('id');
    const tmdbId = url.searchParams.get('tmdbId');
    const mediaType = url.searchParams.get('mediaType') || 'movie';

    let trailers = [];

    // Try Jellyfin RemoteTrailers first
    if (itemId) {
      try {
        const res = await fetch(
          `${config.jellyfinUrl}/Users/${session.jellyfinUserId}/Items/${itemId}?Fields=RemoteTrailers`,
          { headers: { 'X-Emby-Token': session.jellyfinToken }, signal: AbortSignal.timeout(8000) }
        );
        if (res.ok) {
          const item = await res.json();
          (item.RemoteTrailers || []).forEach(t => {
            trailers.push({ name: t.Name || 'Bande-annonce', url: t.Url, source: 'jellyfin' });
          });
        }
      } catch (e) { /* ignore */ }
    }

    // Try Jellyseerr/TMDB if no trailers found and we have tmdbId
    if (trailers.length === 0 && tmdbId && config.jellyseerrUrl) {
      try {
        const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
        const res = await fetch(
          `${config.jellyseerrUrl}/api/v1/${endpoint}/${tmdbId}`,
          { headers: { 'X-Api-Key': config.jellyseerrApiKey }, signal: AbortSignal.timeout(8000) }
        );
        if (res.ok) {
          const data = await res.json();
          const videos = data.relatedVideos || [];
          videos.filter(v => v.type === 'Trailer' || v.type === 'Teaser').forEach(v => {
            const ytUrl = v.site === 'YouTube' ? `https://www.youtube.com/watch?v=${v.key}` : v.url;
            trailers.push({ name: v.name || 'Bande-annonce', url: ytUrl, key: v.key, site: v.site, source: 'tmdb' });
          });
        }
      } catch (e) { /* ignore */ }
    }

    return jsonResponse({ trailers });
  } catch (err) {
    return jsonResponse({ trailers: [], error: err.message }, 500);
  }
}

/* =================================================================
   COLLECTIONS / SAGAS - Movie collections from Jellyfin
   ================================================================= */

async function handleMediaCollection(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);
    const config = await getConfig();
    const url = new URL(req.url);
    const itemId = url.searchParams.get('id');
    const tmdbId = url.searchParams.get('tmdbId');

    let collection = null;
    let items = [];

    // Check Jellyfin for BoxSet (collection)
    if (itemId) {
      try {
        // First get the item to check if it belongs to a collection
        const itemRes = await fetch(
          `${config.jellyfinUrl}/Users/${session.jellyfinUserId}/Items/${itemId}?Fields=ProviderIds`,
          { headers: { 'X-Emby-Token': session.jellyfinToken }, signal: AbortSignal.timeout(8000) }
        );
        if (itemRes.ok) {
          const item = await itemRes.json();
          // Search for BoxSets containing this item's name or from same collection
          const boxSetRes = await fetch(
            `${config.jellyfinUrl}/Users/${session.jellyfinUserId}/Items?IncludeItemTypes=BoxSet&Recursive=true&Fields=Overview,ChildCount`,
            { headers: { 'X-Emby-Token': session.jellyfinToken }, signal: AbortSignal.timeout(8000) }
          );
          if (boxSetRes.ok) {
            const boxSets = await boxSetRes.json();
            // Find a BoxSet that might contain this movie
            for (const bs of (boxSets.Items || [])) {
              const childrenRes = await fetch(
                `${config.jellyfinUrl}/Users/${session.jellyfinUserId}/Items?ParentId=${bs.Id}&Fields=Overview,CommunityRating,PremiereDate`,
                { headers: { 'X-Emby-Token': session.jellyfinToken }, signal: AbortSignal.timeout(8000) }
              );
              if (childrenRes.ok) {
                const children = await childrenRes.json();
                const isInCollection = (children.Items || []).some(c => c.Id === itemId);
                if (isInCollection) {
                  collection = { id: bs.Id, name: bs.Name, overview: bs.Overview || '' };
                  items = (children.Items || []).map(c => ({
                    id: c.Id,
                    name: c.Name,
                    year: c.ProductionYear || '',
                    overview: c.Overview || '',
                    posterUrl: `/api/proxy/image?itemId=${c.Id}&type=Primary&maxWidth=300`,
                    communityRating: c.CommunityRating || 0,
                    isCurrent: c.Id === itemId,
                  }));
                  break;
                }
              }
            }
          }
        }
      } catch (e) { /* ignore collection search errors */ }
    }

    // Try TMDB collection via Jellyseerr
    if (!collection && tmdbId && config.jellyseerrUrl) {
      try {
        const res = await fetch(
          `${config.jellyseerrUrl}/api/v1/movie/${tmdbId}`,
          { headers: { 'X-Api-Key': config.jellyseerrApiKey }, signal: AbortSignal.timeout(8000) }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.collection) {
            collection = {
              id: data.collection.id,
              name: data.collection.name,
              overview: data.collection.overview || '',
              posterUrl: data.collection.posterPath
                ? `/api/proxy/tmdb?path=${data.collection.posterPath}&width=w400`
                : '',
              backdropUrl: data.collection.backdropPath
                ? `/api/proxy/tmdb?path=${data.collection.backdropPath}&width=w1280`
                : '',
            };
            // Fetch collection parts
            if (data.collection.id) {
              try {
                const collRes = await fetch(
                  `${config.jellyseerrUrl}/api/v1/collection/${data.collection.id}`,
                  { headers: { 'X-Api-Key': config.jellyseerrApiKey }, signal: AbortSignal.timeout(8000) }
                );
                if (collRes.ok) {
                  const collData = await collRes.json();
                  items = (collData.parts || []).map(p => ({
                    id: p.id,
                    tmdbId: p.id,
                    name: p.title || p.name || '',
                    year: (p.releaseDate || '').substring(0, 4),
                    overview: p.overview || '',
                    posterUrl: p.posterPath ? `/api/proxy/tmdb?path=${p.posterPath}&width=w300` : '',
                    communityRating: p.voteAverage || 0,
                    isCurrent: String(p.id) === String(tmdbId),
                  }));
                }
              } catch (e) { /* ignore */ }
            }
          }
        }
      } catch (e) { /* ignore */ }
    }

    return jsonResponse({ collection, items });
  } catch (err) {
    return jsonResponse({ collection: null, items: [], error: err.message }, 500);
  }
}

/* =================================================================
   MAIN ROUTE HANDLER
   All /api/* requests are routed here via the catch-all pattern
   ================================================================= */

async function handler(req, context) {
  const { params } = context;
  const resolvedParams = await params;
  const pathSegments = resolvedParams?.path || [];
  const route = pathSegments.join('/');
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // Setup routes
    if (route === 'setup/check') return handleSetupCheck();
    if (route === 'setup/test' && method === 'POST') return handleSetupTest(req);
    if (route === 'setup/save' && method === 'POST') return handleSetupSave(req);

    // Auth routes
    if (route === 'auth/login' && method === 'POST') return handleAuthLogin(req);
    if (route === 'auth/logout' && method === 'POST') return handleAuthLogout(req);
    if (route === 'auth/session') return handleAuthSession(req);

    // Preferences routes
    if (route === 'preferences' && method === 'POST') return handlePreferencesSave(req);
    if (route === 'preferences' && method === 'GET') return handlePreferencesGet(req);

    // Media routes
    if (route === 'media/library') return handleMediaLibrary(req);
    if (route === 'media/genres') return handleMediaGenres(req);
    if (route === 'media/detail') return handleMediaDetail(req);
    if (route === 'media/status') return handleMediaStatus(req);
    if (route === 'media/request' && method === 'POST') return handleMediaRequest(req);
    if (route === 'media/stream') return handleStream(req);
    if (route === 'media/seasons') return handleMediaSeasons(req);
    if (route === 'media/episodes') return handleMediaEpisodes(req);
    if (route === 'media/trailer') return handleMediaTrailer(req);
    if (route === 'media/collection') return handleMediaCollection(req);

    // Search & Discover
    if (route === 'search') return handleSearch(req);
    if (route === 'discover') return handleDiscover(req);

    // Recommendations
    if (route === 'recommendations') return handleRecommendations(req);

    // Proxy routes
    if (route === 'proxy/image') return handleProxyImage(req);
    if (route === 'proxy/tmdb') return handleProxyTmdb(req);
    if (route === 'proxy/stream') return handleProxyStream(req);

    // Health check
    if (route === 'health') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
    }

    return jsonResponse({ error: 'Route not found', path: route }, 404);
  } catch (err) {
    console.error(`[DagzFlix] Error on ${route}:`, err.message);
    return jsonResponse({ error: 'Internal server error', details: err.message }, 500);
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const OPTIONS = handler;
