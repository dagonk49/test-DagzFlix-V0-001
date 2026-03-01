# DagzFlix (Next.js 14 + Jellyfin + Jellyseerr)

DagzFlix est une interface unifiée de streaming et découverte, avec un **BFF API** Next.js (`/api/*`) qui centralise:
- authentification Jellyfin,
- recommandations et recherche,
- demandes Jellyseerr,
- lecture vidéo et suivi de progression.

---

## Version du projet

- **Version courante**: **V0,003**
- **Format**: `V0,001`, `V0,002`, `V0,003`, etc.
- **Règle de suivi (obligatoire)**:
	- À chaque requête utilisateur impliquant une action/changement, la version est incrémentée.
	- La mise à jour est documentée **dans ce README** et dans `WORKLOG_DETAILED.txt`.
	- Chaque entrée contient au minimum: date, demande, modifications, fichiers touchés, validation.

### Journal des versions

- **V0,001** (2026-02-28)
	- Mise en place du protocole de versioning demandé.
	- Ajout du suivi de version obligatoire dans `README.md` et `WORKLOG_DETAILED.txt`.
	- Point de départ officiel pour les prochaines requêtes.

- **V0,002** (2026-02-28)
	- **Objectif 1**: Correction Smart Button séries — `handleMediaStatus` détecte maintenant les séries (ChildCount/RecursiveItemCount) au lieu de MediaSources.
	- **Objectif 2**: Enrichissement MediaDetailView:
		- Section Casting visuel avec photos acteurs (proxy Jellyfin), rôles, scroll horizontal.
		- Réalisateurs / Scénaristes avec badges colorés.
		- Affichage Studios/Networks sous le titre.
		- Genres cliquables → redirection recherche.
	- Fichiers modifiés: `route.js`, `MediaDetailView.jsx`, `page.js`.

- **V0,003** (2026-03-01)
	- **Refactoring majeur Phase 1** — Migration SPA → routage natif App Router Next.js.
	- **Mission 1** — Routage natif:
		- `app/page.js` réécrit : page Accueil uniquement (DashboardView).
		- Nouvelles pages : `app/movies/page.js`, `app/series/page.js`, `app/media/[id]/page.js`, `app/search/page.js`.
		- Pages auth : `app/login/page.js`, `app/setup/page.js`, `app/onboarding/page.js`.
		- Bouton retour navigateur natif fonctionnel (plus de pushState maison).
		- Contextes globaux : `lib/auth-context.js` (AuthProvider), `lib/player-context.js` (PlayerProvider).
		- `lib/item-store.js` : cache de navigation pour transitions instantanées.
		- `components/dagzflix/AppShell.jsx` : shell global (auth guard, navbar, player overlay).
		- `layout.js` : intègre AuthProvider + PlayerProvider + AppShell.
		- `Navbar.jsx` : réécrit avec `useRouter`/`usePathname` — plus de props `onSearch`/`onNavigate`.
	- **Mission 2** — Corrections MediaDetailView:
		- Scroll casting réparé : cartes acteurs `min-w-[120px]` + `overflow-x-auto hide-scrollbar`.
		- Acteurs cliquables : `<Link href="/person/[id]">` (page préparée).
		- Genres cliquables : `<Link href="/search?genre=...">` natif (plus de `onItemClick`).
		- Studios visibles sous le titre (déjà en V0,002, consolidé).
	- **Mission 3** — Moteur de recherche amélioré:
		- Debounce 800ms : la recherche se déclenche automatiquement après saisie.
		- Filtres type : Films | Séries | Tous (barre cliquable).
		- Filtre genre : sélection dynamique parmi la liste de genres, filtrage côté client.
		- URL synchronisée : `/search?q=...&type=...&genre=...`.
		- Composant `SearchView` autonome (utilise `useSearchParams`).
	- Fichiers créés: `auth-context.js`, `player-context.js`, `item-store.js`, `AppShell.jsx`, 7 pages.
	- Fichiers modifiés: `layout.js`, `page.js`, `Navbar.jsx`, `MediaDetailView.jsx`, `SearchView.jsx`.

---

## 1) Stack technique

- **Frontend**: Next.js 14 (App Router), React 18, Framer Motion, Tailwind
- **Backend (BFF)**: route API centralisée dans `app/api/[[...path]]/route.js`
- **DB**: MongoDB (config, sessions, préférences)
- **Médias**: Jellyfin (lecture locale)
- **Discovery/Request**: Jellyseerr / TMDB

---

## 2) Arborescence utile

### Pages (App Router)
- `app/page.js` : Accueil (Hero + Tendances + DashboardView)
- `app/movies/page.js` : Page Films (bibliothèque, recherche, wizard, DagzRank)
- `app/series/page.js` : Page Séries (idem)
- `app/media/[id]/page.js` : Détail d'un média (MediaDetailView)
- `app/search/page.js` : Recherche avec debounce + filtres
- `app/login/page.js` : Connexion Jellyfin
- `app/setup/page.js` : Configuration serveurs
- `app/onboarding/page.js` : Préférences genres

### API BFF
- `app/api/[[...path]]/route.js` : route API centralisée

### Composants
- `components/dagzflix/*` : UI métier (dashboard, wizard, player, smart actions)
- `components/dagzflix/AppShell.jsx` : shell global (auth guard, navbar, player)

### Librairies
- `lib/api.js` : client API + cache
- `lib/auth-context.js` : AuthProvider (session, redirections, login/logout)
- `lib/player-context.js` : PlayerProvider (lecture vidéo globale)
- `lib/item-store.js` : cache de navigation (transitions instantanées)
- `lib/constants.js` : constantes UI/domaine

### Configuration
- `.env.local` : variables d’environnement locales
- `WORKLOG_DETAILED.txt` : journal détaillé des interventions réalisées

---

## 3) Prérequis

- Node.js 18+ (recommandé: 20+)
- npm / yarn
- MongoDB accessible
- Une instance Jellyfin
- (Optionnel mais recommandé) Jellyseerr

---

## 4) Installation

```bash
npm install
```

ou

```bash
yarn install
```

---

## 5) Configuration environnement

Créer un fichier `.env.local` à la racine:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=dagzflix
CORS_ORIGINS=*
```

> Les URLs/API Keys Jellyfin/Jellyseerr sont ensuite sauvegardées via l’écran Setup (`/api/setup/save`).

---

## 6) Lancement

### Développement

```bash
npx next dev --hostname 0.0.0.0 --port 3001
```

Puis ouvrir:
- `http://localhost:3001`

### Build production

```bash
npm run build
npm run start
```

---

## 7) Flux applicatif

1. **Loading**
2. **Setup check** (`/api/setup/check`)
3. Si non configuré: **SetupView**
4. Sinon: **Login Jellyfin**
5. Si onboarding incomplet: **OnboardingView**
6. Sinon: **Dashboard** + sections Films/Séries

---

## 8) API BFF (routes principales)

### Setup / Auth
- `GET /api/setup/check`
- `POST /api/setup/test`
- `POST /api/setup/save`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

### Préférences
- `GET /api/preferences`
- `POST /api/preferences`

### Média
- `GET /api/media/library`
- `GET /api/media/detail`
- `GET /api/media/resume`
- `GET /api/media/seasons`
- `GET /api/media/episodes`
- `GET /api/media/trailer`
- `GET /api/media/collection`
- `GET /api/media/status`
- `GET /api/media/stream`
- `POST /api/media/request`
- `POST /api/media/progress`

### Reco / Recherche
- `GET /api/search`
- `GET /api/discover`
- `GET /api/recommendations`
- `POST /api/wizard/discover`
- `POST /api/wizard/feedback`

### Proxies
- `GET /api/proxy/image`
- `GET /api/proxy/tmdb`

---

## 9) Comportements implémentés importants

### 9.1 Lecture / disponibilité
- Le statut “play” est strictement conditionné à la dispo locale Jellyfin.
- Évite les tentatives de lecture sur des IDs TMDB non locaux.

### 9.2 Trailers
- Agrégation trailer depuis Jellyfin/Jellyseerr si dispo.
- Fallback vers recherche YouTube quand aucun trailer exploitable.

### 9.3 Wizard
- Bouton “Réessayer” côté UI.
- Envoi d’un feedback de rejet (`wizard/feedback`).
- Exclusion des IDs rejetés pour éviter répétitions immédiates.
- Pénalisation des contenus/genres rejetés dans le ranking.

### 9.4 Cache API client
- Le cache n’enregistre plus les réponses d’erreur.
- Le cache est vidé après login réussi pour éviter états obsolètes.

---

## 10) Débogage rapide

### Symptôme: écran figé sur “DAGZFLIX”
1. Vérifier qu’une seule instance Next est active.
2. Redémarrer le serveur dev.
3. Hard refresh navigateur (`Ctrl+F5`).
4. Vérifier les assets `_next` en 200.

### Symptôme: bibliothèque vide
1. Vérifier `/api/auth/session` (authentifié).
2. Vérifier `/api/media/library?...` avec cookie de session.
3. Vérifier que le token Jellyfin en session est valide.
4. Déconnexion/reconnexion pour régénérer la session.

### Symptôme: playback info failed
- Vérifier que l’item est bien local Jellyfin (pas TMDB-only).
- Vérifier endpoint `/api/media/status`.

### Symptôme: trailers non lisibles
- Vérifier `/api/media/trailer`.
- Si pas d’embed possible, fallback externe YouTube est utilisé.

---

## 11) Scripts

`package.json` inclut:
- `npm run dev`
- `npm run dev:no-reload`
- `npm run dev:webpack`
- `npm run build`
- `npm run start`

---

## 12) Notes d’exploitation

- Éviter plusieurs `next dev` en parallèle (conflits de ports/états incohérents).
- Garder MongoDB disponible avant lancement.
- Ne pas exposer publiquement les clés/API sensibles.

---

## 13) Historique de correction

Le détail complet des opérations et correctifs est disponible dans:
- `WORKLOG_DETAILED.txt`

---

## 14) Prochaines améliorations suggérées (optionnel)

- Ajouter observabilité explicite côté UI (message d’erreur API visible au lieu de catch silencieux).
- Ajouter tests d’intégration pour routes critiques `media/*`.
- Isoler la route monolithique en modules pour maintenance plus sûre.

---

## 15) Licence / usage

Aucune licence explicite n’est définie dans ce dépôt à date.
