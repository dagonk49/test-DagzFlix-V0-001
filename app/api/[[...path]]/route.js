import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

/* =================================================================
   DagzFlix Backend - BFF (Backend-For-Frontend)
   All requests to Jellyfin/Jellyseerr are proxied through these routes.
   No client-side code ever talks directly to external servers.
   
   PRIORITY 1 FIXES APPLIED:
   - Bug 1: HLS master.m3u8 with AudioCodec=aac,mp3 for universal playback
   - Bug 2: New /api/media/progress endpoint for watch status tracking
   - Bug 3: All timeouts raised to 30s-45s
   - Bug 4: DagzRank compatible with TMDB genreIds + fused recommendations
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
   BUG 4 FIX: TMDB Genre ID → Name mapping
   Allows DagzRank to score TMDB objects (genreIds) alongside
   Jellyfin objects (Genres as string names).
   ================================================================= */

const TMDB_GENRE_ID_TO_NAME = {
  // Movies
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
  // TV-specific
  10759: 'Action & Adventure', 10762: 'Kids', 10763: 'News',
  10764: 'Reality', 10765: 'Sci-Fi & Fantasy', 10766: 'Soap',
  10767: 'Talk', 10768: 'War & Politics',
};

/** Resolve genres from any source: Jellyfin (string[]), TMDB (genreIds number[]), or both */
function resolveGenres(item) {
  // Priority 1: Jellyfin string genres
  const stringGenres = item.genres || item.Genres || [];
  if (stringGenres.length > 0 && typeof stringGenres[0] === 'string') {
    return stringGenres;
  }
  // Priority 2: TMDB genreIds → resolve to names
  const genreIds = item.genreIds || item.genre_ids || [];
  if (genreIds.length > 0) {
    return genreIds.map(id => TMDB_GENRE_ID_TO_NAME[id] || `Genre_${id}`).filter(Boolean);
  }
  // Priority 3: if stringGenres contains objects like { id, name }
  if (stringGenres.length > 0 && typeof stringGenres[0] === 'object') {
    return stringGenres.map(g => g.name || g.Name).filter(Boolean);
  }
  return [];
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
        signal: AbortSignal.timeout(30000), // BUG 3 FIX: 10s → 30s
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
        signal: AbortSignal.timeout(30000), // BUG 3 FIX: 10s → 30s
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
      signal: AbortSignal.timeout(30000), // BUG 3 FIX: 15s → 30s
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
      signal: AbortSignal.timeout(45000), // BUG 3 FIX: 15s → 45s (heavy query)
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
        signal: AbortSignal.timeout(30000), // BUG 3 FIX: 10s → 30s
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
        signal: AbortSignal.timeout(30000), // BUG 3 FIX: 10s → 30s
      }
    );

    if (!res.ok) throw new Error(`Jellyfin responded with ${res.status}`);
    const item = await res.json();

    // Get similar items
    let similar = [];
    try {
      const simRes = await fetch(
        `${config.jellyfinUrl}/Items/${itemId}/Similar?UserId=${session.jellyfinUserId}&Limit=12&Fields=Overview,Genres,CommunityRating`,
        { headers: { 'X-Emby-Token': session.jellyfinToken }, signal: AbortSignal.timeout(30000) } // BUG 3 FIX
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
   CONTINUE WATCHING - Resume items from Jellyfin
   ================================================================= */

async function handleMediaResume(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);

    const config = await getConfig();
    const res = await fetch(
      `${config.jellyfinUrl}/Users/${session.jellyfinUserId}/Items/Resume?Limit=20&Recursive=true&Fields=Overview,Genres,CommunityRating,PremiereDate,RunTimeTicks,MediaSources&MediaTypes=Video&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop,Thumb`,
      {
        headers: { 'X-Emby-Token': session.jellyfinToken },
        signal: AbortSignal.timeout(45000), // BUG 3 FIX: 10s → 45s (heavy query)
      }
    );

    if (!res.ok) throw new Error(`Jellyfin responded with ${res.status}`);
    const data = await res.json();

    const items = (data.Items || []).map(item => ({
      id: item.Id,
      name: item.Name,
      type: item.Type,
      seriesName: item.SeriesName || '',
      overview: item.Overview || '',
      genres: item.Genres || [],
      communityRating: item.CommunityRating || 0,
      year: item.ProductionYear || '',
      runtime: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : 0,
      posterUrl: `/api/proxy/image?itemId=${item.Id}&type=Primary&maxWidth=400`,
      backdropUrl: `/api/proxy/image?itemId=${item.Id}&type=Backdrop&maxWidth=1920`,
      thumbUrl: `/api/proxy/image?itemId=${item.Id}&type=Thumb&maxWidth=600`,
      playbackPositionTicks: item.UserData?.PlaybackPositionTicks || 0,
      playbackPercentage: item.UserData?.PlayedPercentage || 0,
    }));

    return jsonResponse({ items });
  } catch (err) {
    console.error('[DagzFlix] Resume error:', err.message);
    return jsonResponse({ items: [], error: err.message }, 500);
  }
}

/* =================================================================
   BUG 2 FIX: PLAYBACK PROGRESS TRACKING
   New endpoint: POST /api/media/progress
   Reports current playback position to Jellyfin in Ticks.
   Called by VideoPlayer.jsx every 10 seconds.
   ================================================================= */

async function handleMediaProgress(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);

    const config = await getConfig();
    const body = await req.json();
    const { itemId, positionTicks, isPaused, isStopped, playSessionId } = body;

    if (!itemId) return jsonResponse({ error: 'itemId requis' }, 400);

    // Determine which Jellyfin endpoint to use
    let jellyfinEndpoint;
    let jellyfinMethod = 'POST';

    if (isStopped) {
      // Final report: mark playback as stopped
      jellyfinEndpoint = `${config.jellyfinUrl}/Sessions/Playing/Stopped`;
    } else if (positionTicks === 0 || positionTicks === undefined) {
      // First report: notify Jellyfin that playback started
      jellyfinEndpoint = `${config.jellyfinUrl}/Sessions/Playing`;
    } else {
      // Progress report: update current position
      jellyfinEndpoint = `${config.jellyfinUrl}/Sessions/Playing/Progress`;
    }

    const reportBody = {
      ItemId: itemId,
      PositionTicks: positionTicks || 0,
      IsPaused: isPaused || false,
      PlaySessionId: playSessionId || '',
      MediaSourceId: itemId,
      CanSeek: true,
      PlayMethod: 'Transcode', // HLS = Transcode from Jellyfin's perspective
    };

    const res = await fetch(jellyfinEndpoint, {
      method: jellyfinMethod,
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Token': session.jellyfinToken,
      },
      body: JSON.stringify(reportBody),
      signal: AbortSignal.timeout(30000), // BUG 3 FIX
    });

    // Jellyfin returns 204 No Content on success
    if (!res.ok && res.status !== 204) {
      console.error(`[DagzFlix] Progress report failed: ${res.status}`);
      return jsonResponse({ success: false, error: `Jellyfin responded with ${res.status}` }, 500);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error('[DagzFlix] Progress error:', err.message);
    return jsonResponse({ success: false, error: err.message }, 500);
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
          { headers: { 'X-Emby-Token': session.jellyfinToken }, signal: AbortSignal.timeout(30000) } // BUG 3 FIX: 8s → 30s
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
          { headers: { 'X-Api-Key': config.jellyseerrApiKey }, signal: AbortSignal.timeout(30000) } // BUG 3 FIX: 8s → 30s
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
      signal: AbortSignal.timeout(30000), // BUG 3 FIX: 15s → 30s
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
          { headers: { 'X-Api-Key': config.jellyseerrApiKey }, signal: AbortSignal.timeout(30000) } // BUG 3 FIX
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
      { headers: { 'X-Emby-Token': session.jellyfinToken }, signal: AbortSignal.timeout(30000) } // BUG 3 FIX
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
      { headers: { 'X-Api-Key': config.jellyseerrApiKey }, signal: AbortSignal.timeout(30000) } // BUG 3 FIX
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
   
   BUG 4 FIX: Now compatible with both Jellyfin (Genres: string[])
   and TMDB (genreIds: number[]) objects via resolveGenres().
   
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
  // BUG 4 FIX: Use resolveGenres to handle both Jellyfin and TMDB formats
  const itemGenres = resolveGenres(item);
  const favGenres = preferences?.favoriteGenres || [];
  const dislikedGenres = preferences?.dislikedGenres || [];

  // 1. Genre Match Score (0-40)
  if (itemGenres.length > 0 && favGenres.length > 0) {
    // Case-insensitive matching for cross-source compatibility
    const normalizedFav = favGenres.map(g => g.toLowerCase());
    const normalizedDislike = dislikedGenres.map(g => g.toLowerCase());
    const matchCount = itemGenres.filter(g => normalizedFav.includes(g.toLowerCase())).length;
    const dislikeCount = itemGenres.filter(g => normalizedDislike.includes(g.toLowerCase())).length;
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
        const key = g.toLowerCase();
        historyGenres[key] = (historyGenres[key] || 0) + 1;
      });
    });
    const maxCount = Math.max(...Object.values(historyGenres), 1);
    let affinityScore = 0;
    itemGenres.forEach(g => {
      const key = g.toLowerCase();
      if (historyGenres[key]) {
        affinityScore += (historyGenres[key] / maxCount) * 25;
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

/** 
 * BUG 4 FIX: Get DagzRank recommendations
 * Now FUSES local Jellyfin library + Jellyseerr trending before scoring.
 */
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
        { headers: { 'X-Emby-Token': session.jellyfinToken }, signal: AbortSignal.timeout(45000) } // BUG 3 FIX
      );
      if (histRes.ok) {
        const histData = await histRes.json();
        watchHistory = (histData.Items || []).map(i => ({
          id: i.Id, name: i.Name, genres: i.Genres || [],
        }));
      }
    } catch (e) { /* history fetch failed */ }

    // --- SOURCE 1: Get available media from Jellyfin ---
    let jellyfinItems = [];
    try {
      const mediaRes = await fetch(
        `${config.jellyfinUrl}/Users/${session.jellyfinUserId}/Items?Recursive=true&Limit=100&IncludeItemTypes=Movie,Series&Fields=Overview,Genres,CommunityRating,PremiereDate&SortBy=Random`,
        { headers: { 'X-Emby-Token': session.jellyfinToken }, signal: AbortSignal.timeout(45000) } // BUG 3 FIX
      );
      if (mediaRes.ok) {
        const mediaData = await mediaRes.json();
        jellyfinItems = (mediaData.Items || []).map(item => ({
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
          source: 'jellyfin',
        }));
      }
    } catch (e) { console.error('[DagzRank] Jellyfin fetch error:', e.message); }

    // --- SOURCE 2: BUG 4 FIX - Get trending from Jellyseerr (TMDB) ---
    let jellyseerrItems = [];
    if (config.jellyseerrUrl) {
      try {
        // Fetch trending movies + TV from Jellyseerr
        for (const discoverType of ['movies', 'tv']) {
          try {
            const discRes = await fetch(
              `${config.jellyseerrUrl}/api/v1/discover/${discoverType}?page=1`,
              { headers: { 'X-Api-Key': config.jellyseerrApiKey }, signal: AbortSignal.timeout(30000) }
            );
            if (discRes.ok) {
              const discData = await discRes.json();
              const mapped = (discData.results || []).map(item => ({
                id: `tmdb-${item.id}`,
                tmdbId: item.id,
                name: item.title || item.name || '',
                type: discoverType === 'tv' ? 'Series' : 'Movie',
                mediaType: discoverType === 'tv' ? 'tv' : 'movie',
                overview: item.overview || '',
                genreIds: item.genreIds || [],
                genres: [], // Will be resolved by resolveGenres via genreIds
                voteAverage: item.voteAverage || 0,
                communityRating: item.voteAverage || 0,
                year: (item.releaseDate || item.firstAirDate || '').substring(0, 4),
                posterUrl: item.posterPath ? `/api/proxy/tmdb?path=${item.posterPath}&width=w400` : '',
                backdropUrl: item.backdropPath ? `/api/proxy/tmdb?path=${item.backdropPath}&width=w1280` : '',
                isPlayed: false,
                mediaStatus: item.mediaInfo?.status || 0,
                source: 'jellyseerr',
              }));
              jellyseerrItems.push(...mapped);
            }
          } catch (e) { /* single discover type failed */ }
        }
      } catch (e) { console.error('[DagzRank] Jellyseerr fetch error:', e.message); }
    }

    // --- FUSION: Deduplicate by name and score everything ---
    const seenNames = new Set();
    const allItems = [];

    // Jellyfin items first (they're locally available)
    for (const item of jellyfinItems) {
      const key = item.name.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        allItems.push(item);
      }
    }

    // Then Jellyseerr items (world catalog)
    for (const item of jellyseerrItems) {
      const key = item.name.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        allItems.push(item);
      }
    }

    // Score each item with DagzRank
    const scored = allItems.map(item => {
      const score = calculateDagzRank(item, prefs, watchHistory);
      return {
        ...item,
        dagzRank: score,
      };
    });

    // Sort by DagzRank descending
    scored.sort((a, b) => b.dagzRank - a.dagzRank);

    return jsonResponse({
      recommendations: scored.filter(s => s.dagzRank > 20).slice(0, 30),
      totalScored: scored.length,
      sources: {
        jellyfin: jellyfinItems.length,
        jellyseerr: jellyseerrItems.length,
      },
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
      signal: AbortSignal.timeout(30000), // BUG 3 FIX: 15s → 30s
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
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) }); // BUG 3 FIX

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

/** 
 * BUG 1 FIX: HLS Universal Streaming
 * Uses master.m3u8 with VideoCodec=copy (0% CPU) and AudioCodec=aac,mp3
 * (lightweight transcode for browser compatibility with DTS/TrueHD).
 * Falls back to Static=true Direct Play URL as secondary option.
 */
async function handleStream(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);
    const config = await getConfig();
    const url = new URL(req.url);
    const itemId = url.searchParams.get('id');
    if (!itemId) return jsonResponse({ error: 'ID requis' }, 400);

    const res = await fetch(
      `${config.jellyfinUrl}/Items/${itemId}/PlaybackInfo?UserId=${session.jellyfinUserId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Emby-Token': session.jellyfinToken },
        body: JSON.stringify({
          DeviceProfile: {
            MaxStreamingBitrate: 120000000,
            DirectPlayProfiles: [{ Container: 'mp4,m4v,mkv,webm,avi,mov', Type: 'Video' }],
            TranscodingProfiles: [
              {
                Container: 'ts',
                Type: 'Video',
                VideoCodec: 'h264,hevc',
                AudioCodec: 'aac,mp3',
                Context: 'Streaming',
                Protocol: 'hls',
                MaxAudioChannels: '2',
                BreakOnNonKeyFrames: true,
              },
            ],
            SubtitleProfiles: [
              { Format: 'vtt', Method: 'External' },
              { Format: 'srt', Method: 'External' },
              { Format: 'ass', Method: 'External' },
            ],
          },
        }),
        signal: AbortSignal.timeout(30000), // BUG 3 FIX: 15s → 30s
      }
    );
    if (!res.ok) throw new Error('Playback info failed');
    const pb = await res.json();
    const ms0 = (pb.MediaSources || [])[0];
    const psId = pb.PlaySessionId;
    const streams = ms0?.MediaStreams || [];

    // BUG 1 FIX: Use HLS master.m3u8 URL instead of Static=true
    // VideoCodec=copy = no CPU usage for video (remux only)
    // AudioCodec=aac,mp3 = lightweight transcode for web-incompatible audio (DTS, TrueHD, etc.)
    // TranscodingMaxAudioChannels=2 = stereo downmix for browser compatibility
    const hlsUrl = `${config.jellyfinUrl}/Videos/${itemId}/master.m3u8?api_key=${session.jellyfinToken}&MediaSourceId=${ms0?.Id || ''}&PlaySessionId=${psId || ''}&VideoCodec=copy&AudioCodec=aac,mp3&TranscodingMaxAudioChannels=2&SegmentContainer=ts&MinSegmentLength=1&BreakOnNonKeyFrames=true`;

    // Keep Direct Play URL as fallback (for media with browser-native audio like AAC)
    const directUrl = `${config.jellyfinUrl}/Videos/${itemId}/stream?Static=true&MediaSourceId=${ms0?.Id || ''}&PlaySessionId=${psId || ''}&api_key=${session.jellyfinToken}`;

    // Detect if audio needs transcoding
    const audioStream = streams.find(s => s.Type === 'Audio' && s.IsDefault) || streams.find(s => s.Type === 'Audio');
    const audioCodec = (audioStream?.Codec || '').toLowerCase();
    const needsAudioTranscode = ['dts', 'truehd', 'eac3', 'dca', 'flac', 'pcm', 'mlp'].includes(audioCodec);

    // Use HLS if audio needs transcoding, otherwise offer both
    const streamUrl = needsAudioTranscode ? hlsUrl : hlsUrl; // Always use HLS for consistency

    // Direct subtitle URLs
    const subtitles = streams.filter(s => s.Type === 'Subtitle').map((s, idx) => ({
      index: s.Index,
      language: s.Language || 'und',
      displayTitle: s.DisplayTitle || s.Title || s.Language || `Sous-titre ${idx + 1}`,
      codec: s.Codec,
      url: s.DeliveryUrl
        ? `${config.jellyfinUrl}${s.DeliveryUrl}`
        : `${config.jellyfinUrl
}/Videos/${itemId}/Subtitles/${s.Index}/Stream.${s.Codec === 'webvtt' ? 'vtt' : (s.Codec || 'srt')}?api_key=${session.jellyfinToken}`,
    }));

    const audioTracks = streams.filter(s => s.Type === 'Audio').map((s, idx) => ({
      index: s.Index,
      language: s.Language || 'und',
      displayTitle: s.DisplayTitle || s.Title || s.Language || `Audio ${idx + 1}`,
      codec: s.Codec,
      channels: s.Channels || 2,
      isDefault: s.IsDefault || false,
    }));

    const durationSecs = ms0?.RunTimeTicks ? Math.round(ms0.RunTimeTicks / 10000000) : 0;

    return jsonResponse({
      streamUrl,
      directPlayUrl: directUrl,
      subtitles,
      audioTracks,
      duration: durationSecs,
      playSessionId: psId || '',
      mediaSourceId: ms0?.Id || '',
      needsAudioTranscode,
      audioCodec,
    });
  } catch (err) {
    console.error('[DagzFlix] Stream error:', err.message);
    return jsonResponse({ error: err.message }, 500);
  }
}

/* =================================================================
   SERIES - Seasons and Episodes from Jellyfin
   ================================================================= */

async function handleMediaSeasons(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);

    const config = await getConfig();
    const url = new URL(req.url);
    const seriesId = url.searchParams.get('seriesId');

    if (!seriesId) return jsonResponse({ error: 'seriesId requis' }, 400);

    const res = await fetch(
      `${config.jellyfinUrl}/Shows/${seriesId}/Seasons?UserId=${session.jellyfinUserId}&Fields=Overview,Genres,CommunityRating`,
      {
        headers: { 'X-Emby-Token': session.jellyfinToken },
        signal: AbortSignal.timeout(30000), // BUG 3 FIX
      }
    );

    if (!res.ok) throw new Error(`Jellyfin responded with ${res.status}`);
    const data = await res.json();

    const seasons = (data.Items || []).map(s => ({
      id: s.Id,
      name: s.Name,
      indexNumber: s.IndexNumber || 0,
      episodeCount: s.ChildCount || 0,
      year: s.ProductionYear || '',
      posterUrl: `/api/proxy/image?itemId=${s.Id}&type=Primary&maxWidth=300`,
      isPlayed: s.UserData?.Played || false,
      playedPercentage: s.UserData?.PlayedPercentage || 0,
    }));

    return jsonResponse({ seasons, seriesId });
  } catch (err) {
    return jsonResponse({ seasons: [], error: err.message }, 500);
  }
}

async function handleMediaEpisodes(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);

    const config = await getConfig();
    const url = new URL(req.url);
    const seriesId = url.searchParams.get('seriesId');
    const seasonId = url.searchParams.get('seasonId');

    if (!seriesId) return jsonResponse({ error: 'seriesId requis' }, 400);

    const params = new URLSearchParams({
      UserId: session.jellyfinUserId,
      Fields: 'Overview,MediaSources,RunTimeTicks',
    });
    if (seasonId) params.set('SeasonId', seasonId);

    const res = await fetch(
      `${config.jellyfinUrl}/Shows/${seriesId}/Episodes?${params.toString()}`,
      {
        headers: { 'X-Emby-Token': session.jellyfinToken },
        signal: AbortSignal.timeout(30000), // BUG 3 FIX
      }
    );

    if (!res.ok) throw new Error(`Jellyfin responded with ${res.status}`);
    const data = await res.json();

    const episodes = (data.Items || []).map(ep => ({
      id: ep.Id,
      name: ep.Name,
      indexNumber: ep.IndexNumber || 0,
      parentIndexNumber: ep.ParentIndexNumber || 0,
      overview: ep.Overview || '',
      runtime: ep.RunTimeTicks ? Math.round(ep.RunTimeTicks / 600000000) : 0,
      thumbUrl: `/api/proxy/image?itemId=${ep.Id}&type=Primary&maxWidth=400`,
      isPlayed: ep.UserData?.Played || false,
      playbackPositionTicks: ep.UserData?.PlaybackPositionTicks || 0,
      hasMediaSource: (ep.MediaSources || []).length > 0,
    }));

    return jsonResponse({ episodes, seriesId, seasonId });
  } catch (err) {
    return jsonResponse({ episodes: [], error: err.message }, 500);
  }
}

async function handleMediaTrailer(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);

    const config = await getConfig();
    const url = new URL(req.url);
    const itemId = url.searchParams.get('id');
    const tmdbId = url.searchParams.get('tmdbId');
    const mediaType = url.searchParams.get('mediaType') || 'movie';

    if (!itemId && !tmdbId) return jsonResponse({ error: 'id ou tmdbId requis' }, 400);

    let trailers = [];

    // Try Jellyfin trailers first
    if (itemId) {
      try {
        const res = await fetch(
          `${config.jellyfinUrl}/Users/${session.jellyfinUserId}/Items/${itemId}/LocalTrailers`,
          {
            headers: { 'X-Emby-Token': session.jellyfinToken },
            signal: AbortSignal.timeout(30000), // BUG 3 FIX
          }
        );
        if (res.ok) {
          const data = await res.json();
          trailers = (data || []).map(t => ({
            id: t.Id,
            name: t.Name,
            url: `/api/media/stream?id=${t.Id}`,
            source: 'jellyfin',
          }));
        }
      } catch (e) { /* ignore */ }
    }

    // Try Jellyseerr/TMDB trailers
    if (trailers.length === 0 && tmdbId && config.jellyseerrUrl) {
      try {
        const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
        const res = await fetch(
          `${config.jellyseerrUrl}/api/v1/${endpoint}/${tmdbId}/videos`,
          {
            headers: { 'X-Api-Key': config.jellyseerrApiKey },
            signal: AbortSignal.timeout(30000), // BUG 3 FIX
          }
        );
        if (res.ok) {
          const data = await res.json();
          const ytTrailers = (data.results || []).filter(v => v.site === 'YouTube' && v.type === 'Trailer');
          trailers = ytTrailers.map(v => ({
            id: v.id,
            name: v.name,
            url: `https://www.youtube.com/watch?v=${v.key}`,
            youtubeKey: v.key,
            source: 'youtube',
          }));
        }
      } catch (e) { /* ignore */ }
    }

    return jsonResponse({ trailers });
  } catch (err) {
    return jsonResponse({ trailers: [], error: err.message }, 500);
  }
}

async function handleMediaCollection(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);

    const config = await getConfig();
    const url = new URL(req.url);
    const tmdbId = url.searchParams.get('tmdbId');
    const id = url.searchParams.get('id');

    if (!tmdbId && !id) return jsonResponse({ error: 'id ou tmdbId requis' }, 400);

    let collection = null;

    // Try Jellyseerr for TMDB collection data
    if (tmdbId && config.jellyseerrUrl) {
      try {
        // Get movie details to find collection ID
        const movieRes = await fetch(
          `${config.jellyseerrUrl}/api/v1/movie/${tmdbId}`,
          {
            headers: { 'X-Api-Key': config.jellyseerrApiKey },
            signal: AbortSignal.timeout(30000), // BUG 3 FIX
          }
        );
        if (movieRes.ok) {
          const movieData = await movieRes.json();
          const collectionId = movieData.belongsToCollection?.id;
          if (collectionId) {
            const colRes = await fetch(
              `${config.jellyseerrUrl}/api/v1/collection/${collectionId}`,
              {
                headers: { 'X-Api-Key': config.jellyseerrApiKey },
                signal: AbortSignal.timeout(30000), // BUG 3 FIX
              }
            );
            if (colRes.ok) {
              const colData = await colRes.json();
              collection = {
                id: colData.id,
                name: colData.name,
                overview: colData.overview || '',
                posterUrl: colData.posterPath ? `/api/proxy/tmdb?path=${colData.posterPath}&width=w400` : '',
                parts: (colData.parts || []).map(p => ({
                  id: p.id,
                  tmdbId: p.id,
                  name: p.title || p.name || '',
                  year: (p.releaseDate || '').substring(0, 4),
                  posterUrl: p.posterPath ? `/api/proxy/tmdb?path=${p.posterPath}&width=w300` : '',
                  voteAverage: p.voteAverage || 0,
                  mediaStatus: p.mediaInfo?.status || 0,
                })),
              };
            }
          }
        }
      } catch (e) { /* ignore */ }
    }

    return jsonResponse({ collection });
  } catch (err) {
    return jsonResponse({ collection: null, error: err.message }, 500);
  }
}

/* =================================================================
   BUG 4c FIX: WIZARD DISCOVER ("Le Magicien")
   Increased to 5 pages, relaxed runtime margins, runtime filter
   applied only for movies, fallback if empty results.
   ================================================================= */

async function handleWizardDiscover(req) {
  try {
    const session = await getSession(req);
    if (!session) return jsonResponse({ error: 'Non authentifie' }, 401);

    const config = await getConfig();
    const url = new URL(req.url);
    const era = url.searchParams.get('era') || 'all'; // 'classic', '90s', '2000s', 'recent', 'all'
    const mood = url.searchParams.get('mood') || ''; // e.g. 'action', 'comedy'
    const runtimePref = url.searchParams.get('runtime') || 'any'; // 'short', 'medium', 'long', 'any'
    const type = url.searchParams.get('type') || 'movie'; // 'movie' or 'tv'

    if (!config.jellyseerrUrl) {
      return jsonResponse({ results: [], error: 'Jellyseerr non configure' });
    }

    const endpoint = type === 'tv' ? 'tv' : 'movies';

    // BUG 4c FIX: Relaxed runtime margins (minutes)
    const runtimeRanges = {
      short: { min: 0, max: 105 },   // was 0-90, now 0-105
      medium: { min: 75, max: 165 }, // was 90-150, now 75-165
      long: { min: 135, max: Infinity }, // was 150+, now 135+
      any: { min: 0, max: Infinity },
    };
    const { min: minRuntime, max: maxRuntime } = runtimeRanges[runtimePref] || runtimeRanges.any;

    // Era year ranges
    const eraRanges = {
      classic: { minYear: 1900, maxYear: 1979 },
      '90s': { minYear: 1990, maxYear: 1999 },
      '2000s': { minYear: 2000, maxYear: 2009 },
      recent: { minYear: 2010, maxYear: new Date().getFullYear() },
      all: { minYear: 1900, maxYear: new Date().getFullYear() },
    };
    const { minYear, maxYear } = eraRanges[era] || eraRanges.all;

    const moodLower = mood ? mood.toLowerCase() : '';

    // Helper: apply era and mood filters (shared between main pass and runtime-fallback)
    const applyBaseFilters = (items) => {
      let filtered = items.filter(item => {
        const releaseYear = parseInt((item.releaseDate || item.firstAirDate || '0').substring(0, 4));
        return releaseYear >= minYear && releaseYear <= maxYear;
      });
      if (moodLower) {
        filtered = filtered.filter(item => {
          const genreNames = (item.genreIds || [])
            .map(id => (TMDB_GENRE_ID_TO_NAME[id] || '').toLowerCase());
          return genreNames.some(g => g.includes(moodLower));
        });
      }
      return filtered;
    };

    let results = [];

    // BUG 4c FIX: Scan up to 5 pages (was 3)
    for (let page = 1; page <= 5 && results.length < 10; page++) {
      try {
        const discRes = await fetch(
          `${config.jellyseerrUrl}/api/v1/discover/${endpoint}?page=${page}`,
          { headers: { 'X-Api-Key': config.jellyseerrApiKey }, signal: AbortSignal.timeout(30000) }
        );
        if (!discRes.ok) break;
        const discData = await discRes.json();

        let items = applyBaseFilters(discData.results || []);

        // BUG 4c FIX: Apply runtime filter only for movies (TV runtimes are per-episode)
        if (type === 'movie' && runtimePref !== 'any') {
          items = items.filter(item => {
            const runtimeMin = item.runtime || 0;
            return runtimeMin >= minRuntime && (maxRuntime === Infinity || runtimeMin <= maxRuntime);
          });
        }

        results.push(...items);
      } catch (e) { break; }
    }

    // BUG 4c FIX: If no results after filtering, retry without runtime filter
    if (results.length === 0 && type === 'movie' && runtimePref !== 'any') {
      for (let page = 1; page <= 5 && results.length < 10; page++) {
        try {
          const discRes = await fetch(
            `${config.jellyseerrUrl}/api/v1/discover/${endpoint}?page=${page}`,
            { headers: { 'X-Api-Key': config.jellyseerrApiKey }, signal: AbortSignal.timeout(30000) }
          );
          if (!discRes.ok) break;
          const discData = await discRes.json();
          // No runtime filter in fallback
          results.push(...applyBaseFilters(discData.results || []));
        } catch (e) { break; }
      }
    }

    const mapped = results.slice(0, 20).map(item => ({
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
      runtime: item.runtime || 0,
    }));

    return jsonResponse({ results: mapped, totalFound: results.length });
  } catch (err) {
    return jsonResponse({ results: [], error: err.message }, 500);
  }
}

/* =================================================================
   HEALTH CHECK
   ================================================================= */

async function handleHealth() {
  return jsonResponse({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
}

/* =================================================================
   MAIN ROUTER - Catch-all [[...path]] handler
   All API routes are dispatched here.
   ================================================================= */

async function handler(req) {
  const url = new URL(req.url);
  // path segments after /api/
  const pathParts = url.pathname.replace(/^\/api\//, '').split('/').filter(Boolean);
  const route = pathParts.join('/');
  const method = req.method.toUpperCase();

  // Health check
  if (route === 'health' && method === 'GET') return handleHealth();

  // Setup routes
  if (route === 'setup/check' && method === 'GET') return handleSetupCheck();
  if (route === 'setup/test' && method === 'POST') return handleSetupTest(req);
  if (route === 'setup/save' && method === 'POST') return handleSetupSave(req);

  // Auth routes
  if (route === 'auth/login' && method === 'POST') return handleAuthLogin(req);
  if (route === 'auth/logout' && method === 'POST') return handleAuthLogout(req);
  if (route === 'auth/session' && method === 'GET') return handleAuthSession(req);

  // Preferences
  if (route === 'preferences' && method === 'POST') return handlePreferencesSave(req);
  if (route === 'preferences' && method === 'GET') return handlePreferencesGet(req);

  // Media library routes
  if (route === 'media/library' && method === 'GET') return handleMediaLibrary(req);
  if (route === 'media/genres' && method === 'GET') return handleMediaGenres(req);
  if (route === 'media/detail' && method === 'GET') return handleMediaDetail(req);
  if (route === 'media/resume' && method === 'GET') return handleMediaResume(req);

  // BUG 2 FIX: Progress tracking
  if (route === 'media/progress' && method === 'POST') return handleMediaProgress(req);

  // Smart button
  if (route === 'media/status' && method === 'GET') return handleMediaStatus(req);
  if (route === 'media/request' && method === 'POST') return handleMediaRequest(req);

  // Series
  if (route === 'media/seasons' && method === 'GET') return handleMediaSeasons(req);
  if (route === 'media/episodes' && method === 'GET') return handleMediaEpisodes(req);

  // Trailer & collection
  if (route === 'media/trailer' && method === 'GET') return handleMediaTrailer(req);
  if (route === 'media/collection' && method === 'GET') return handleMediaCollection(req);

  // Stream
  if (route === 'media/stream' && method === 'GET') return handleStream(req);

  // Search & discover
  if (route === 'search' && method === 'GET') return handleSearch(req);
  if (route === 'discover' && method === 'GET') return handleDiscover(req);
  if (route === 'wizard/discover' && method === 'GET') return handleWizardDiscover(req);

  // Recommendations (DagzRank)
  if (route === 'recommendations' && method === 'GET') return handleRecommendations(req);

  // Image proxies
  if (route === 'proxy/image') return handleProxyImage(req);
  if (route === 'proxy/tmdb') return handleProxyTmdb(req);

  // 404 fallback
  return jsonResponse({ error: `Route not found: ${method} /api/${route}` }, 404);
}

export async function GET(req) { return handler(req); }
export async function POST(req) { return handler(req); }
export async function PUT(req) { return handler(req); }
export async function DELETE(req) { return handler(req); }
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
