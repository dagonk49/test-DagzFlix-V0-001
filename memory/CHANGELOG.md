# DagzFlix Changelog

## Feb 27, 2026 - Major Refactor + Feature Completion

### Completed
- **Codebase Refactoring**: Split monolithic `page.js` (726 lines) into 16 modular files:
  - `lib/api.js` - Cache system + API helpers
  - `lib/constants.js` - Genres, moods, eras, durations
  - 14 component files in `components/dagzflix/`
  - Slim orchestrator `page.js` (~100 lines)

- **Bug Fixes**:
  - Fixed DB_NAME in `.env` (was `your_database_name`, now `dagzflix`)
  - Fixed French character rendering (Unicode escapes → UTF-8)
  - Fixed saga/collection state persistence between navigations (proper state reset)
  - Fixed back button (now uses navigation history stack instead of always returning to dashboard)

- **New Features**:
  - "Continue Watching" row on dashboard (`/api/media/resume` endpoint)
  - Navigation history tracking for smart back button
  - Added `data-testid` attributes to all interactive elements

- **Backend**:
  - Added `/api/media/resume` endpoint for Jellyfin resume items
  - Streaming uses Direct Play URLs (no proxy, no timeout)
  - All 14 backend tests passing

- **Frontend**:
  - Login flow, UI rendering, French text, glassmorphism all verified
  - Responsive design tested on desktop/tablet/mobile

### Previous Work (before refactor)
- Initial MVP with setup wizard, login, dashboard
- All backend API endpoints for Jellyfin/Jellyseerr proxy
- DagzRank recommendation algorithm
- Le Magicien (Wizard) discovery feature
- Smart Button for Play/Request/Pending
- Video Player with Direct Play
- Collection/Saga display
- Client-side caching
