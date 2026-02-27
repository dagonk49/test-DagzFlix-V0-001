'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Play, Download, Clock, Search, LogOut, Star, ChevronLeft,
  ChevronRight, Film, Tv, Heart, ThumbsDown, Check, X, Loader2,
  Server, Link2, Shield, ArrowRight, Eye, EyeOff, Home, TrendingUp,
  Sparkles, Info, AlertCircle, Clapperboard, Youtube,
  Pause, Volume2, VolumeX, Maximize, Layers, PlayCircle,
  SkipBack, SkipForward, Subtitles, AudioLines, Settings, ChevronDown,
} from 'lucide-react';

/* =================================================================
   CACHE SYSTEM - Reduces server requests significantly
   ================================================================= */

const apiCache = new Map();
const CACHE_TTLS = {
  'setup/check': 120000,
  'auth/session': 60000,
  'media/library': 300000,
  'media/detail': 600000,
  'media/genres': 3600000,
  'media/seasons': 600000,
  'media/episodes': 600000,
  'media/trailer': 3600000,
  'media/collection': 3600000,
  'media/status': 60000,
  'search': 120000,
  'discover': 300000,
  'recommendations': 300000,
  'preferences': 300000,
};

function getCacheTTL(path) {
  for (const [prefix, ttl] of Object.entries(CACHE_TTLS)) {
    if (path.startsWith(prefix)) return ttl;
  }
  return 60000;
}

async function api(path, options = {}) {
  const res = await fetch(`/api/${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  return res.json();
}

/** Cached API call - only caches GET requests */
async function cachedApi(path, options = {}) {
  const isGet = !options.method || options.method === 'GET';
  if (isGet) {
    const cached = apiCache.get(path);
    if (cached && Date.now() - cached.ts < getCacheTTL(path)) {
      return cached.data;
    }
  }
  const data = await api(path, options);
  if (isGet) apiCache.set(path, { data, ts: Date.now() });
  return data;
}

/** Invalidate cache entries matching a prefix */
function invalidateCache(prefix) {
  for (const key of apiCache.keys()) {
    if (key.startsWith(prefix)) apiCache.delete(key);
  }
}

/* =================================================================
   CONSTANTS
   ================================================================= */

const GENRE_LIST = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music',
  'Mystery', 'Romance', 'Science Fiction', 'Thriller', 'War', 'Western',
];
const GENRE_EMOJIS = {
  Action: '\ud83d\udca5', Adventure: '\ud83d\uddfa\ufe0f', Animation: '\ud83c\udfa8', Comedy: '\ud83d\ude02',
  Crime: '\ud83d\udd0d', Documentary: '\ud83d\udcf9', Drama: '\ud83c\udfad', Family: '\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66',
  Fantasy: '\ud83e\uddd9', History: '\ud83d\udcdc', Horror: '\ud83d\udc7b', Music: '\ud83c\udfb5',
  Mystery: '\ud83d\udd75\ufe0f', Romance: '\ud83d\udc95', 'Science Fiction': '\ud83d\ude80',
  Thriller: '\ud83d\ude30', War: '\u2694\ufe0f', Western: '\ud83e\udd20',
};
const transition = { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] };
const pageVariants = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
};

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* =================================================================
   LOADING SCREEN
   ================================================================= */

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#050505]">
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
        <h1 className="text-6xl font-black tracking-tighter mb-6">
          <span className="text-red-600">DAGZ</span><span className="text-white">FLIX</span></h1>
        <div className="flex items-center justify-center gap-1.5">
          {[0, 1, 2].map(i => (
            <motion.div key={i} className="w-2.5 h-2.5 bg-red-600 rounded-full"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/* =================================================================
   SETUP VIEW
   ================================================================= */

function SetupView({ onComplete }) {
  const [step, setStep] = useState(1);
  const [jellyfinUrl, setJellyfinUrl] = useState('');
  const [jellyfinApiKey, setJellyfinApiKey] = useState('');
  const [jellyseerrUrl, setJellyseerrUrl] = useState('');
  const [jellyseerrApiKey, setJellyseerrApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const testConnection = async (type) => {
    setTesting(true); setTestResult(null); setError('');
    try {
      const url = type === 'jellyfin' ? jellyfinUrl : jellyseerrUrl;
      const apiKey = type === 'jellyfin' ? jellyfinApiKey : jellyseerrApiKey;
      const res = await api('setup/test', { method: 'POST', body: JSON.stringify({ type, url, apiKey }) });
      if (res.success) setTestResult({ type, ...res }); else setError(res.error || 'Echec');
    } catch (err) { setError(err.message); }
    setTesting(false);
  };

  const saveConfig = async () => {
    setSaving(true); setError('');
    try {
      const res = await api('setup/save', { method: 'POST', body: JSON.stringify({ jellyfinUrl, jellyfinApiKey, jellyseerrUrl, jellyseerrApiKey }) });
      if (res.success) { invalidateCache('setup'); onComplete(); } else setError(res.error);
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <h1 className="text-7xl font-black tracking-tighter mb-3">
            <span className="text-red-600">DAGZ</span><span>FLIX</span></h1>
          <p className="text-gray-500 text-lg font-light">Configuration initiale</p>
        </motion.div>

        <div className="flex items-center justify-center gap-3 mb-10">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold transition-all duration-500 ${
                s === step ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 scale-110' :
                s < step ? 'bg-white/10 text-green-400' : 'bg-white/5 text-gray-600'}`}>
                {s < step ? <Check className="w-5 h-5" /> : s}</div>
              {s < 3 && <div className={`w-14 h-[2px] rounded-full ${s < step ? 'bg-green-500/50' : 'bg-white/5'}`} />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              className="glass-strong rounded-3xl p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3.5 bg-purple-500/15 rounded-2xl"><Server className="w-6 h-6 text-purple-400" /></div>
                <div><h2 className="text-xl font-bold">Serveur Jellyfin</h2><p className="text-sm text-gray-500">Votre serveur de streaming</p></div></div>
              <div className="space-y-5">
                <div><Label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">URL du serveur *</Label>
                  <Input value={jellyfinUrl} onChange={e => setJellyfinUrl(e.target.value)} placeholder="https://jellyfin.example.com"
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-12 rounded-xl" /></div>
                <div><Label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Cle API (optionnelle)</Label>
                  <Input value={jellyfinApiKey} onChange={e => setJellyfinApiKey(e.target.value)} placeholder="Votre cle API"
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-12 rounded-xl" type="password" /></div>
                {testResult?.type === 'jellyfin' && <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-400 text-sm flex items-center gap-2">
                  <Check className="w-4 h-4" /> {testResult.serverName} (v{testResult.version})</div>}
                {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />{error}</div>}
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1 border-white/10 text-gray-300 hover:bg-white/5 h-12 rounded-xl"
                    onClick={() => testConnection('jellyfin')} disabled={!jellyfinUrl || testing}>
                    {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}Tester</Button>
                  <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white h-12 rounded-xl font-semibold"
                    onClick={() => { setStep(2); setError(''); setTestResult(null); }} disabled={!jellyfinUrl}>
                    Suivant <ArrowRight className="w-4 h-4 ml-2" /></Button></div>
              </div>
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              className="glass-strong rounded-3xl p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3.5 bg-blue-500/15 rounded-2xl"><Download className="w-6 h-6 text-blue-400" /></div>
                <div><h2 className="text-xl font-bold">Jellyseerr</h2><p className="text-sm text-gray-500">Moteur de requetes (optionnel)</p></div></div>
              <div className="space-y-5">
                <div><Label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">URL Jellyseerr</Label>
                  <Input value={jellyseerrUrl} onChange={e => setJellyseerrUrl(e.target.value)} placeholder="https://jellyseerr.example.com"
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-12 rounded-xl" /></div>
                <div><Label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Cle API</Label>
                  <Input value={jellyseerrApiKey} onChange={e => setJellyseerrApiKey(e.target.value)} placeholder="Votre cle API"
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-12 rounded-xl" type="password" /></div>
                {testResult?.type === 'jellyseerr' && <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-400 text-sm flex items-center gap-2">
                  <Check className="w-4 h-4" /> Jellyseerr v{testResult.version}</div>}
                {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">{error}</div>}
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="border-white/10 text-gray-300 h-12 rounded-xl" onClick={() => { setStep(1); setError(''); }}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Retour</Button>
                  {jellyseerrUrl && <Button variant="outline" className="flex-1 border-white/10 text-gray-300 h-12 rounded-xl"
                    onClick={() => testConnection('jellyseerr')} disabled={testing}>
                    {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}Tester</Button>}
                  <Button className="flex-1 bg-red-600 hover:bg-red-700 h-12 rounded-xl font-semibold" onClick={() => { setStep(3); setError(''); }}>
                    Suivant <ArrowRight className="w-4 h-4 ml-2" /></Button></div>
              </div>
            </motion.div>
          )}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              className="glass-strong rounded-3xl p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3.5 bg-green-500/15 rounded-2xl"><Shield className="w-6 h-6 text-green-400" /></div>
                <div><h2 className="text-xl font-bold">Confirmation</h2><p className="text-sm text-gray-500">Verifiez la configuration</p></div></div>
              <div className="space-y-4">
                <div className="p-5 bg-white/3 rounded-2xl border border-white/5"><p className="text-purple-400 text-sm font-semibold mb-1">Jellyfin</p><p className="text-sm text-gray-300 break-all">{jellyfinUrl}</p></div>
                <div className="p-5 bg-white/3 rounded-2xl border border-white/5"><p className="text-blue-400 text-sm font-semibold mb-1">Jellyseerr</p><p className="text-sm text-gray-300 break-all">{jellyseerrUrl || 'Non configure'}</p></div>
                {error && <div className="p-4 bg-red-500/10 rounded-2xl text-red-400 text-sm">{error}</div>}
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="border-white/10 text-gray-300 h-12 rounded-xl" onClick={() => setStep(2)}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Retour</Button>
                  <Button className="flex-1 bg-red-600 hover:bg-red-700 h-12 rounded-xl font-bold pulse-glow" onClick={saveConfig} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}Sauvegarder</Button></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* =================================================================
   LOGIN VIEW
   ================================================================= */

function LoginView({ onLogin }) {
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const res = await api('auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      if (res.success) { invalidateCache('auth'); onLogin(res.user, res.onboardingComplete); }
      else setError(res.error || 'Echec');
    } catch (err) { setError(err.message); } setLoading(false);
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-900/20 rounded-full blur-[150px]" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-900/10 rounded-full blur-[120px]" />
      <div className="relative w-full max-w-md z-10">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h1 className="text-7xl font-black tracking-tighter mb-3"><span className="text-red-600">DAGZ</span><span>FLIX</span></h1>
          <p className="text-gray-500 font-light">Connectez-vous avec vos identifiants Jellyfin</p></motion.div>
        <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          onSubmit={handleLogin} className="glass-strong rounded-3xl p-10 space-y-6">
          <div><Label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Nom d'utilisateur</Label>
            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Nom d'utilisateur"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-13 rounded-xl text-base" autoFocus /></div>
          <div><Label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Mot de passe</Label>
            <div className="relative">
              <Input value={password} onChange={e => setPassword(e.target.value)} type={showPw ? 'text' : 'password'} placeholder="Mot de passe"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-13 rounded-xl text-base pr-12" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300">
                {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button></div></div>
          {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
          <Button type="submit" className="w-full h-13 bg-red-600 hover:bg-red-700 text-white font-bold text-lg rounded-xl"
            disabled={loading || !username || !password}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Se connecter'}</Button>
        </motion.form>
      </div>
    </motion.div>
  );
}

/* =================================================================
   ONBOARDING VIEW
   ================================================================= */

function OnboardingView({ onComplete }) {
  const [favorites, setFavorites] = useState([]); const [disliked, setDisliked] = useState([]);
  const [saving, setSaving] = useState(false);
  const toggle = (g, list, setList, other, setOther) => {
    if (other.includes(g)) setOther(other.filter(x => x !== g));
    setList(list.includes(g) ? list.filter(x => x !== g) : [...list, g]);
  };
  const save = async () => {
    setSaving(true);
    await api('preferences', { method: 'POST', body: JSON.stringify({ favoriteGenres: favorites, dislikedGenres: disliked }) });
    invalidateCache('preferences'); invalidateCache('recommendations'); setSaving(false); onComplete();
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10"><div className="w-16 h-16 bg-red-600/15 rounded-3xl flex items-center justify-center mx-auto mb-5">
          <Sparkles className="w-8 h-8 text-red-500" /></div>
          <h2 className="text-3xl font-bold mb-2">Bienvenue sur DagzFlix !</h2><p className="text-gray-500">Personnalisez vos recommandations</p></div>
        <div className="glass-strong rounded-3xl p-8 mb-6">
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2"><Heart className="w-5 h-5 text-red-500" /> Genres que vous adorez</h3>
          <div className="flex flex-wrap gap-2">{GENRE_LIST.map(g => (
            <button key={g} onClick={() => toggle(g, favorites, setFavorites, disliked, setDisliked)}
              className={`px-4 py-2.5 rounded-2xl text-sm font-medium transition-all ${
                favorites.includes(g) ? 'bg-red-600 text-white shadow-lg shadow-red-600/20 scale-105' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
              {GENRE_EMOJIS[g]} {g}</button>))}</div></div>
        <div className="glass-strong rounded-3xl p-8 mb-8">
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2"><ThumbsDown className="w-5 h-5 text-gray-500" /> Genres que vous evitez</h3>
          <div className="flex flex-wrap gap-2">{GENRE_LIST.map(g => (
            <button key={g} onClick={() => toggle(g, disliked, setDisliked, favorites, setFavorites)}
              className={`px-4 py-2.5 rounded-2xl text-sm font-medium transition-all ${
                disliked.includes(g) ? 'bg-gray-600 text-white line-through' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
              {GENRE_EMOJIS[g]} {g}</button>))}</div></div>
        <Button onClick={save} disabled={saving} className="w-full h-14 bg-red-600 hover:bg-red-700 font-bold text-lg rounded-2xl">
          {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}Commencer</Button>
        <button onClick={onComplete} className="w-full mt-4 text-gray-600 hover:text-gray-400 text-sm">Passer</button>
      </div>
    </motion.div>
  );
}

/* =================================================================
   NAVBAR
   ================================================================= */

function Navbar({ user, onSearch, onNavigate, currentView }) {
  const [searchOpen, setSearchOpen] = useState(false); const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => { const h = () => setScrolled(window.scrollY > 50); window.addEventListener('scroll', h); return () => window.removeEventListener('scroll', h); }, []);
  const submit = (e) => { e.preventDefault(); if (searchQuery.trim()) { onSearch(searchQuery.trim()); setSearchOpen(false); } };
  const logout = async () => { await api('auth/logout', { method: 'POST' }); apiCache.clear(); window.location.reload(); };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled ? 'bg-black/80 backdrop-blur-2xl shadow-2xl' : 'bg-gradient-to-b from-black/60 to-transparent'}`}>
      <div className="max-w-[1800px] mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <button onClick={() => onNavigate('dashboard')}><h1 className="text-2xl font-black tracking-tighter">
            <span className="text-red-600">DAGZ</span><span>FLIX</span></h1></button>
          <div className="hidden md:flex items-center gap-1">
            {[{ id: 'dashboard', label: 'Accueil', icon: Home }, { id: 'movies', label: 'Films', icon: Film }, { id: 'series', label: 'Series', icon: Tv }].map(t => (
              <button key={t.id} onClick={() => onNavigate(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  currentView === t.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                <t.icon className="w-4 h-4" />{t.label}</button>))}</div></div>
        <div className="flex items-center gap-3">
          <AnimatePresence>{searchOpen ? (
            <motion.form key="s" initial={{ width: 0, opacity: 0 }} animate={{ width: 320, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              onSubmit={submit} className="relative">
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Rechercher..."
                className="bg-white/5 border-white/10 text-white h-10 pl-10 pr-10 rounded-xl" autoFocus />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
            </motion.form>) : (
            <button onClick={() => setSearchOpen(true)} className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5">
              <Search className="w-5 h-5" /></button>)}</AnimatePresence>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-red-600/20">
            {user?.name?.[0]?.toUpperCase() || 'U'}</div>
          <button onClick={logout} className="p-2 rounded-xl text-gray-500 hover:text-red-500 hover:bg-white/5" title="Deconnexion">
            <LogOut className="w-4 h-4" /></button></div></div>
    </nav>
  );
}

/* =================================================================
   MEDIA CARD
   ================================================================= */

function MediaCard({ item, onClick, size = 'normal' }) {
  const [imgErr, setImgErr] = useState(false);
  const w = size === 'large' ? 'w-[220px] md:w-[260px]' : 'w-[160px] md:w-[185px]';
  return (
    <motion.div className={`flex-shrink-0 ${w} cursor-pointer`} onClick={() => onClick(item)}
      whileHover={{ scale: 1.06, y: -8 }} transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}>
      <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-white/3 relative card-reflection group shadow-lg shadow-black/30">
        {!imgErr && item.posterUrl ? (
          <img src={item.posterUrl} alt={item.name} className="w-full h-full object-cover" onError={() => setImgErr(true)} loading="lazy" />
        ) : (<div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-950">
          <Clapperboard className="w-10 h-10 text-gray-700" /></div>)}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-end p-4">
          <p className="text-white font-semibold text-sm line-clamp-2">{item.name}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {item.year && <span className="text-gray-400 text-xs">{item.year}</span>}
            {(item.communityRating || item.voteAverage) > 0 && (
              <span className="flex items-center gap-1 text-yellow-400 text-xs"><Star className="w-3 h-3 fill-current" />{(item.communityRating || item.voteAverage).toFixed(1)}</span>)}</div>
          {item.dagzRank > 0 && (<div className="mt-1.5 flex items-center gap-1">
            <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full" style={{ width: `${item.dagzRank}%` }} /></div>
            <span className="text-red-400 text-[10px] font-bold">{item.dagzRank}%</span></div>)}</div>
        {item.mediaStatus === 5 && <div className="absolute top-2.5 right-2.5"><div className="bg-green-500/90 backdrop-blur text-white text-[10px] px-2 py-0.5 rounded-lg font-medium">Disponible</div></div>}
      </div>
      <p className="text-gray-400 text-sm mt-2.5 truncate font-medium">{item.name}</p>
    </motion.div>
  );
}

/* =================================================================
   MEDIA ROW
   ================================================================= */

function MediaRow({ title, items, icon, onItemClick, loading, size }) {
  const ref = useRef(null);
  const scroll = (d) => ref.current?.scrollBy({ left: d === 'left' ? -600 : 600, behavior: 'smooth' });
  if (!loading && (!items || items.length === 0)) return null;
  return (
    <div className="mb-12 group/row">
      <h3 className="text-lg font-bold text-white mb-5 px-6 md:px-10 flex items-center gap-2.5">
        {icon}{title}{loading && <Loader2 className="w-4 h-4 animate-spin text-gray-600" />}</h3>
      <div className="relative">
        <button onClick={() => scroll('left')} className="absolute left-0 top-0 bottom-8 z-10 w-14 bg-gradient-to-r from-[#050505] to-transparent hidden group-hover/row:flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"><ChevronLeft className="w-5 h-5" /></div></button>
        <button onClick={() => scroll('right')} className="absolute right-0 top-0 bottom-8 z-10 w-14 bg-gradient-to-l from-[#050505] to-transparent hidden group-hover/row:flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"><ChevronRight className="w-5 h-5" /></div></button>
        <div ref={ref} className="flex gap-4 overflow-x-auto hide-scrollbar px-6 md:px-10 pb-4">
          {loading ? Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`flex-shrink-0 ${size === 'large' ? 'w-[220px] md:w-[260px]' : 'w-[160px] md:w-[185px]'}`}>
              <div className="aspect-[2/3] skeleton" /><div className="h-4 w-20 skeleton mt-2.5" /></div>
          )) : (items || []).map((item, idx) => <MediaCard key={item.id || idx} item={item} onClick={onItemClick} size={size} />)}</div>
      </div>
    </div>
  );
}

/* =================================================================
   HERO SECTION
   ================================================================= */

function HeroSection({ item, onPlay, onDetail }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <div className="relative h-[75vh] min-h-[550px]">
      {!imgErr && item?.backdropUrl ? (
        <img src={item.backdropUrl} alt={item.name} className="absolute inset-0 w-full h-full object-cover" onError={() => setImgErr(true)} />
      ) : (<div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-[#050505]" />)}
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/30 to-[#050505]/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/90 via-[#050505]/30 to-transparent" />
      <div className="relative z-10 h-full flex items-end">
        <div className="px-6 md:px-16 pb-24 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            {item?.dagzRank > 0 && (
              <div className="inline-flex items-center gap-1.5 bg-red-600/20 backdrop-blur-sm border border-red-500/20 text-red-300 rounded-full px-3 py-1 text-sm font-medium mb-4">
                <Sparkles className="w-3.5 h-3.5" /> Recommande a {item.dagzRank}%</div>)}
            <h1 className="text-4xl md:text-6xl font-black mb-4 leading-[1.1]">{item?.name || 'DAGZFLIX'}</h1>
            {item && <div className="flex flex-wrap items-center gap-3 mb-4 text-sm text-gray-400">
              {item.year && <span>{item.year}</span>}
              {item.runtime > 0 && <span>{item.runtime} min</span>}
              {(item.communityRating || item.voteAverage) > 0 && (
                <span className="flex items-center gap-1 text-yellow-400"><Star className="w-4 h-4 fill-current" />{(item.communityRating || item.voteAverage).toFixed(1)}</span>)}
            </div>}
            {item?.overview && <p className="text-gray-300 text-base mb-8 line-clamp-3 max-w-xl font-light leading-relaxed">{item.overview}</p>}
            {item && <div className="flex items-center gap-3">
              <Button onClick={() => onPlay(item)} className="bg-white hover:bg-gray-100 text-black font-bold px-8 h-13 text-base rounded-xl shadow-xl shadow-white/10">
                <Play className="w-5 h-5 mr-2 fill-current" /> Lecture</Button>
              <Button onClick={() => onDetail(item)} variant="outline" className="border-white/20 text-white hover:bg-white/10 h-13 px-6 rounded-xl backdrop-blur">
                <Info className="w-5 h-5 mr-2" /> Plus d'infos</Button></div>}
          </motion.div></div></div>
    </div>
  );
}

/* =================================================================
   SMART BUTTON
   ================================================================= */

function SmartButton({ item, onPlay }) {
  const [status, setStatus] = useState('loading'); const [requesting, setRequesting] = useState(false); const [requested, setRequested] = useState(false);
  useEffect(() => { if (item) checkStatus(); }, [item?.id]);
  const checkStatus = async () => {
    setStatus('loading');
    try {
      const p = new URLSearchParams();
      if (item.id) p.set('id', item.id);
      if (item.tmdbId || item.providerIds?.Tmdb) p.set('tmdbId', item.tmdbId || item.providerIds?.Tmdb);
      p.set('mediaType', item.type === 'Series' ? 'tv' : 'movie');
      const res = await cachedApi(`media/status?${p.toString()}`);
      setStatus(res.status || 'unknown');
    } catch { setStatus('unknown'); }
  };
  const handleReq = async () => {
    setRequesting(true);
    try {
      const res = await api('media/request', { method: 'POST',
        body: JSON.stringify({ tmdbId: item.tmdbId || item.providerIds?.Tmdb, mediaType: item.type === 'Series' ? 'tv' : 'movie' }) });
      if (res.success) { setRequested(true); setStatus('pending'); invalidateCache('media/status'); }
    } catch (e) { console.error(e); } setRequesting(false);
  };
  const cls = "h-13 px-8 text-base font-bold rounded-xl transition-all duration-300";
  if (status === 'loading') return <Button className={`${cls} bg-white/5 text-gray-500`} disabled><Loader2 className="w-5 h-5 animate-spin mr-2" /> Verification...</Button>;
  if (status === 'available' || status === 'partial') return <Button onClick={() => onPlay(item)} className={`${cls} bg-white hover:bg-gray-100 text-black shadow-xl shadow-white/10`}><Play className="w-5 h-5 mr-2 fill-current" /> LECTURE</Button>;
  if (status === 'pending') return <Button className={`${cls} bg-yellow-500/10 text-yellow-400 border border-yellow-500/30`} disabled><Clock className="w-5 h-5 mr-2" /> EN COURS D'ACQUISITION</Button>;
  return <Button onClick={handleReq} disabled={requesting || requested} className={`${cls} bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/20`}>
    {requesting ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Envoi...</> : requested ? <><Check className="w-5 h-5 mr-2" /> Demande envoyee</> : <><Download className="w-5 h-5 mr-2" /> DEMANDER</>}</Button>;
}

/* =================================================================
   TRAILER BUTTON
   ================================================================= */

function TrailerButton({ item }) {
  const [trailers, setTrailers] = useState([]); const [showModal, setShowModal] = useState(false); const [loading, setLoading] = useState(false);
  const fetch_ = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (item.id) p.set('id', item.id);
      if (item.tmdbId || item.providerIds?.Tmdb) p.set('tmdbId', item.tmdbId || item.providerIds?.Tmdb);
      p.set('mediaType', item.type === 'Series' ? 'tv' : 'movie');
      const res = await cachedApi(`media/trailer?${p.toString()}`);
      setTrailers(res.trailers || []);
      if ((res.trailers || []).length > 0) setShowModal(true);
    } catch (e) { console.error(e); } setLoading(false);
  };
  const ytId = (url) => { const m = (url || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/); return m ? m[1] : null; };

  return (<>
    <Button onClick={fetch_} disabled={loading} variant="outline" className="h-13 px-6 rounded-xl border-white/15 text-white hover:bg-white/5 backdrop-blur">
      {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Youtube className="w-5 h-5 mr-2 text-red-500" />}Bande-annonce</Button>
    <AnimatePresence>{showModal && trailers.length > 0 && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl" onClick={() => setShowModal(false)}>
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
          className="w-full max-w-4xl glass-strong rounded-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5"><h3 className="text-lg font-bold">Bande-annonce</h3>
            <button onClick={() => setShowModal(false)} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10"><X className="w-5 h-5" /></button></div>
          <div className="aspect-video bg-black">{(() => {
            const id = ytId(trailers[0]?.url) || trailers[0]?.key;
            return id ? <iframe src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`} className="w-full h-full" allowFullScreen allow="autoplay; encrypted-media" /> :
              <div className="w-full h-full flex items-center justify-center"><a href={trailers[0]?.url} target="_blank" rel="noopener noreferrer" className="text-red-400"><Youtube className="w-8 h-8" /></a></div>;
          })()}</div>
        </motion.div></motion.div>)}</AnimatePresence>
  </>);
}

/* =================================================================
   VIDEO PLAYER - Apple TV Style with full controls
   ================================================================= */

function VideoPlayer({ item, episodeId, onClose }) {
  const [streamUrl, setStreamUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [subtitles, setSubtitles] = useState([]);
  const [audioTracks, setAudioTracks] = useState([]);
  const [activeSubtitle, setActiveSubtitle] = useState(-1);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const videoRef = useRef(null);
  const controlsTimer = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => { fetchStream(); return () => { if (controlsTimer.current) clearTimeout(controlsTimer.current); }; }, []);

  const fetchStream = async () => {
    try {
      const id = episodeId || item?.id;
      if (!id) { setError('ID manquant'); setLoading(false); return; }
      const res = await api(`media/stream?id=${id}`);
      if (res.streamUrl) {
        setStreamUrl(res.streamUrl);
        setSubtitles(res.subtitles || []);
        setAudioTracks(res.audioTracks || []);
        if (res.duration) setDuration(res.duration);
      } else setError(res.error || 'Stream indisponible');
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => { if (isPlaying) setShowControls(false); }, 4000);
  }, [isPlaying]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true); }
    else { videoRef.current.pause(); setIsPlaying(false); }
    resetControlsTimer();
  };

  const skip = (seconds) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + seconds));
    resetControlsTimer();
  };

  const handleVolumeChange = (val) => {
    if (!videoRef.current) return;
    const v = parseFloat(val); setVolume(v); videoRef.current.volume = v;
    setIsMuted(v === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) { videoRef.current.muted = false; videoRef.current.volume = volume || 0.5; setIsMuted(false); }
    else { videoRef.current.muted = true; setIsMuted(true); }
  };

  const handleSeek = (e) => {
    if (!videoRef.current || !progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = pct * (videoRef.current.duration || 0);
    resetControlsTimer();
  };

  const toggleFullscreen = () => {
    const el = videoRef.current?.parentElement?.parentElement;
    if (document.fullscreenElement) document.exitFullscreen();
    else el?.requestFullscreen?.();
  };

  const handleSubtitle = (idx) => {
    setActiveSubtitle(idx);
    if (!videoRef.current) return;
    const tracks = videoRef.current.textTracks;
    for (let i = 0; i < tracks.length; i++) { tracks[i].mode = i === idx ? 'showing' : 'hidden'; }
    setShowSubMenu(false);
  };

  const onTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
    if (videoRef.current.duration) setDuration(videoRef.current.duration);
    if (videoRef.current.buffered.length > 0) {
      setBuffered(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
      onMouseMove={resetControlsTimer} onClick={(e) => { if (e.target === e.currentTarget) togglePlay(); }}>

      {loading ? (
        <div className="text-center"><Loader2 className="w-12 h-12 animate-spin text-red-600 mx-auto mb-4" /><p className="text-gray-400">Chargement...</p></div>
      ) : error ? (
        <div className="text-center max-w-md"><AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Lecture impossible</h3><p className="text-gray-400 mb-6">{error}</p>
          <Button onClick={onClose} className="bg-white/10 hover:bg-white/20 rounded-xl">Fermer</Button></div>
      ) : (
        <div className="w-full h-full relative">
          <video ref={videoRef} src={streamUrl} className="w-full h-full object-contain" autoPlay
            onTimeUpdate={onTimeUpdate} onPlay={() => setIsPlaying(true)} onPause={() => { setIsPlaying(false); setShowControls(true); }}
            onLoadedMetadata={(e) => setDuration(e.target.duration)} onClick={togglePlay}>
            {subtitles.map((sub, i) => (
              <track key={i} kind="subtitles" src={sub.deliveryUrl} srcLang={sub.language} label={sub.displayTitle}
                default={i === 0} />
            ))}
          </video>

          {/* Controls overlay - Apple TV style */}
          <div className={`absolute inset-0 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-6 flex items-center justify-between">
              <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20 transition-all">
                <ChevronLeft className="w-6 h-6" /></button>
              <div className="text-center flex-1 px-4">
                <h3 className="text-base font-bold truncate">{item?.name}</h3>
                {episodeId && <p className="text-gray-400 text-sm">Episode en cours</p>}
              </div>
              <div className="w-10" />
            </div>

            {/* Center controls */}
            <div className="absolute inset-0 flex items-center justify-center gap-12 pointer-events-none">
              <button onClick={() => skip(-10)} className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20 transition-all pointer-events-auto">
                <SkipBack className="w-6 h-6" />
                <span className="absolute -bottom-5 text-[10px] text-gray-400">10s</span></button>
              <button onClick={togglePlay} className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center hover:bg-white/30 transition-all pointer-events-auto shadow-2xl">
                {isPlaying ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-1" />}</button>
              <button onClick={() => skip(30)} className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20 transition-all pointer-events-auto">
                <SkipForward className="w-6 h-6" />
                <span className="absolute -bottom-5 text-[10px] text-gray-400">30s</span></button>
            </div>

            {/* Bottom bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 pt-16">
              {/* Progress bar */}
              <div className="mb-4 group/prog cursor-pointer" ref={progressRef} onClick={handleSeek}>
                <div className="relative h-1.5 group-hover/prog:h-3 bg-white/15 rounded-full transition-all overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-white/20 rounded-full" style={{ width: `${bufferedPct}%` }} />
                  <div className="absolute inset-y-0 left-0 bg-red-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-red-600 rounded-full shadow-lg opacity-0 group-hover/prog:opacity-100 transition-opacity"
                    style={{ left: `${progress}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                {/* Left: time */}
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-gray-300">{formatTime(currentTime)}</span>
                  <span className="text-sm text-gray-600">/</span>
                  <span className="text-sm font-mono text-gray-500">{formatTime(duration)}</span>
                </div>

                {/* Right: controls */}
                <div className="flex items-center gap-2">
                  {/* Volume */}
                  <div className="flex items-center gap-2 group/vol">
                    <button onClick={toggleMute} className="p-2 rounded-xl hover:bg-white/10 transition-all">
                      {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-gray-400" /> : <Volume2 className="w-5 h-5" />}</button>
                    <div className="w-0 group-hover/vol:w-24 overflow-hidden transition-all duration-300">
                      <input type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume}
                        onChange={e => handleVolumeChange(e.target.value)}
                        className="w-24 h-1 appearance-none bg-white/20 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full" /></div>
                  </div>

                  {/* Subtitles */}
                  {subtitles.length > 0 && (
                    <div className="relative">
                      <button onClick={() => { setShowSubMenu(!showSubMenu); setShowAudioMenu(false); }}
                        className={`p-2 rounded-xl transition-all ${activeSubtitle >= 0 ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-gray-400'}`}>
                        <Subtitles className="w-5 h-5" /></button>
                      {showSubMenu && (
                        <div className="absolute bottom-12 right-0 glass-strong rounded-2xl p-2 min-w-[200px] max-h-[300px] overflow-y-auto">
                          <button onClick={() => handleSubtitle(-1)}
                            className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${activeSubtitle === -1 ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'}`}>
                            Desactiver</button>
                          {subtitles.map((s, i) => (
                            <button key={i} onClick={() => handleSubtitle(i)}
                              className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${activeSubtitle === i ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'}`}>
                              {s.displayTitle}</button>))}
                        </div>)}
                    </div>)}

                  {/* Audio tracks */}
                  {audioTracks.length > 1 && (
                    <div className="relative">
                      <button onClick={() => { setShowAudioMenu(!showAudioMenu); setShowSubMenu(false); }}
                        className="p-2 rounded-xl hover:bg-white/10 text-gray-400 transition-all">
                        <AudioLines className="w-5 h-5" /></button>
                      {showAudioMenu && (
                        <div className="absolute bottom-12 right-0 glass-strong rounded-2xl p-2 min-w-[200px]">
                          {audioTracks.map((a, i) => (
                            <button key={i} className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${
                              a.isDefault ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'}`}>
                              {a.displayTitle} ({a.channels}ch)</button>))}
                        </div>)}
                    </div>)}

                  {/* Fullscreen */}
                  <button onClick={toggleFullscreen} className="p-2 rounded-xl hover:bg-white/10 transition-all">
                    <Maximize className="w-5 h-5" /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* =================================================================
   EPISODE CARD
   ================================================================= */

function EpisodeCard({ ep, onPlay }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <motion.div whileHover={{ scale: 1.01 }} className="glass-card rounded-2xl overflow-hidden cursor-pointer group" onClick={() => onPlay(ep.id)}>
      <div className="flex gap-4 p-4">
        <div className="relative w-40 aspect-video rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
          {!imgErr && (ep.thumbUrl || ep.backdropUrl) ? (
            <img src={ep.thumbUrl || ep.backdropUrl} alt={ep.name} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
          ) : (<div className="w-full h-full flex items-center justify-center"><PlayCircle className="w-8 h-8 text-gray-600" /></div>)}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"><Play className="w-5 h-5 fill-current" /></div></div>
          {ep.isPlayed && <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-lg bg-green-500/80 flex items-center justify-center"><Check className="w-3 h-3" /></div>}
        </div>
        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500 font-mono">E{String(ep.episodeNumber).padStart(2, '0')}</span>
            {ep.runtime > 0 && <span className="text-xs text-gray-600">{ep.runtime} min</span>}</div>
          <h4 className="font-semibold text-white text-sm mb-1.5 truncate">{ep.name}</h4>
          <p className="text-gray-500 text-xs line-clamp-2 leading-relaxed">{ep.overview}</p></div>
      </div>
    </motion.div>
  );
}

/* =================================================================
   MEDIA DETAIL VIEW - Fixed saga state bug + subtitle/audio on page
   ================================================================= */

function MediaDetailView({ item, onBack, onPlay, onItemClick }) {
  const [detail, setDetail] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [collection, setCollection] = useState(null);
  const [collectionItems, setCollectionItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingEps, setLoadingEps] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [playEpisodeId, setPlayEpisodeId] = useState(null);
  const [subtitles, setSubtitles] = useState([]);
  const [audioTracks, setAudioTracks] = useState([]);

  // KEY FIX: Use item.id as dependency and reset ALL state on change
  const itemKey = item?.id || item?.tmdbId || '';

  useEffect(() => {
    // Reset ALL state when item changes
    setDetail(null);
    setSimilar([]);
    setSeasons([]);
    setSelectedSeason(null);
    setEpisodes([]);
    setCollection(null);
    setCollectionItems([]);
    setSubtitles([]);
    setAudioTracks([]);
    setImgError(false);
    setLoading(true);

    fetchAll();
  }, [itemKey]);

  const fetchAll = async () => {
    let fetchedItem = item;

    // Fetch detail from Jellyfin
    if (item.id && !item.tmdbId) {
      try {
        const res = await cachedApi(`media/detail?id=${item.id}`);
        if (res.item) { setDetail(res.item); fetchedItem = res.item; setSimilar(res.similar || []); }
      } catch (e) { console.error(e); }
    } else {
      setDetail(item); fetchedItem = item;
    }

    const isSeries = fetchedItem?.type === 'Series';
    const fId = fetchedItem?.id;
    const tmdbId = fetchedItem?.tmdbId || fetchedItem?.providerIds?.Tmdb;

    // Fetch seasons for series
    if (isSeries && fId) {
      try {
        const res = await cachedApi(`media/seasons?seriesId=${fId}`);
        const s = res.seasons || [];
        setSeasons(s);
        if (s.length > 0) { setSelectedSeason(s[0]); fetchEpisodes(fId, s[0].id); }
      } catch (e) { console.error(e); }
    }

    // Fetch collection for movies (use fetchedItem directly, not stale state)
    if (!isSeries) {
      try {
        const p = new URLSearchParams();
        if (fId) p.set('id', fId);
        if (tmdbId) p.set('tmdbId', tmdbId);
        const res = await cachedApi(`media/collection?${p.toString()}`);
        setCollection(res.collection || null);
        setCollectionItems(res.items || []);
      } catch (e) { console.error(e); }
    }

    // Fetch stream info for subtitles/audio display on page
    if (fId) {
      try {
        const res = await cachedApi(`media/stream?id=${fId}`);
        setSubtitles(res.subtitles || []);
        setAudioTracks(res.audioTracks || []);
      } catch (e) { /* stream info not critical for display */ }
    }

    setLoading(false);
  };

  const fetchEpisodes = async (seriesId, seasonId) => {
    setLoadingEps(true);
    try {
      const res = await cachedApi(`media/episodes?seriesId=${seriesId}&seasonId=${seasonId}`);
      setEpisodes(res.episodes || []);
    } catch (e) { console.error(e); }
    setLoadingEps(false);
  };

  const handleSeasonChange = (s) => {
    setSelectedSeason(s);
    const d = detail || item;
    if (d?.id) fetchEpisodes(d.id, s.id);
  };

  const d = detail || item;
  const isSeries = d?.type === 'Series';

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="min-h-screen bg-[#050505]">
      <AnimatePresence>{showPlayer && (
        <VideoPlayer item={d} episodeId={playEpisodeId} onClose={() => { setShowPlayer(false); setPlayEpisodeId(null); }} />)}</AnimatePresence>

      {/* Backdrop */}
      <div className="relative h-[55vh] min-h-[400px]">
        {!imgError && d?.backdropUrl ? (
          <img src={d.backdropUrl} alt={d.name} className="absolute inset-0 w-full h-full object-cover" onError={() => setImgError(true)} />
        ) : (<div className="absolute inset-0 bg-gradient-to-br from-red-950/20 via-gray-900 to-[#050505]" />)}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/50 to-[#050505]/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/80 to-transparent" />
        <button onClick={onBack} className="absolute top-20 left-6 z-20 w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center hover:bg-white/20">
          <ChevronLeft className="w-5 h-5" /></button>
      </div>

      <div className="relative -mt-56 z-10 px-6 md:px-16 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row gap-10">
          {/* Poster */}
          <div className="flex-shrink-0 w-48 md:w-56">
            <div className="aspect-[2/3] rounded-3xl overflow-hidden shadow-2xl shadow-black/60 bg-white/5 ring-1 ring-white/10">
              {d?.posterUrl ? <img src={d.posterUrl} alt={d.name} className="w-full h-full object-cover" /> :
                <div className="w-full h-full flex items-center justify-center"><Clapperboard className="w-16 h-16 text-gray-700" /></div>}
            </div></div>

          <div className="flex-1 pt-4">
            <h1 className="text-3xl md:text-5xl font-black mb-4 leading-tight">{d?.name}</h1>

            <div className="flex flex-wrap items-center gap-2.5 mb-5">
              {d?.year && <span className="px-3 py-1.5 rounded-xl bg-white/5 text-gray-300 text-sm">{d.year}</span>}
              {d?.runtime > 0 && <span className="px-3 py-1.5 rounded-xl bg-white/5 text-gray-300 text-sm flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{d.runtime} min</span>}
              {(d?.communityRating || d?.voteAverage) > 0 && (
                <span className="px-3 py-1.5 rounded-xl bg-yellow-500/10 text-yellow-400 text-sm flex items-center gap-1.5"><Star className="w-3.5 h-3.5 fill-current" />{(d.communityRating || d.voteAverage).toFixed(1)}</span>)}
              <span className="px-3 py-1.5 rounded-xl bg-white/5 text-gray-300 text-sm flex items-center gap-1.5">
                {isSeries ? <><Tv className="w-3.5 h-3.5" /> Serie</> : <><Film className="w-3.5 h-3.5" /> Film</>}</span>
              {isSeries && seasons.length > 0 && <span className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-300 text-sm flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> {seasons.length} saison{seasons.length > 1 ? 's' : ''}</span>}
            </div>

            {(d?.genres || []).length > 0 && <div className="flex flex-wrap gap-2 mb-5">
              {d.genres.map(g => <span key={g} className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-300 text-sm border border-red-500/10">{GENRE_EMOJIS[g]} {g}</span>)}</div>}

            {d?.dagzRank > 0 && (
              <div className="mb-5 inline-flex items-center gap-3 glass rounded-2xl px-5 py-3">
                <Sparkles className="w-5 h-5 text-red-400" /><span className="text-red-300 font-bold">DagzRank</span>
                <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full" style={{ width: `${d.dagzRank}%` }} /></div>
                <span className="text-red-400 font-bold">{d.dagzRank}%</span></div>)}

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <SmartButton item={d} onPlay={() => setShowPlayer(true)} />
              <TrailerButton item={d} />
            </div>

            <p className="text-gray-400 leading-relaxed mb-6 max-w-2xl font-light">{d?.overview}</p>

            {/* Subtitle & Audio info on page */}
            {(subtitles.length > 0 || audioTracks.length > 0) && (
              <div className="flex flex-wrap gap-4 mb-6">
                {subtitles.length > 0 && <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Subtitles className="w-4 h-4" />{subtitles.length} sous-titre{subtitles.length > 1 ? 's' : ''}
                  <span className="text-gray-600">({subtitles.map(s => s.language).join(', ')})</span></div>}
                {audioTracks.length > 0 && <div className="flex items-center gap-2 text-sm text-gray-500">
                  <AudioLines className="w-4 h-4" />{audioTracks.length} piste{audioTracks.length > 1 ? 's' : ''} audio
                  <span className="text-gray-600">({audioTracks.map(a => a.displayTitle).join(', ')})</span></div>}
              </div>)}

            {(d?.people || []).length > 0 && <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Distribution</h3>
              <div className="flex flex-wrap gap-2">{d.people.filter(p => p.type === 'Actor').slice(0, 8).map((p, i) => (
                <span key={i} className="px-3 py-1.5 rounded-xl bg-white/3 text-gray-300 text-sm border border-white/5">{p.name}</span>))}</div></div>}
          </div>
        </div>

        {/* SEASONS & EPISODES */}
        {isSeries && seasons.length > 0 && (
          <div className="mt-14">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Layers className="w-5 h-5 text-purple-400" /> Saisons et Episodes</h2>
            <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar pb-2">
              {seasons.map(s => (
                <button key={s.id} onClick={() => handleSeasonChange(s)}
                  className={`px-5 py-2.5 rounded-2xl text-sm font-medium transition-all whitespace-nowrap ${
                    selectedSeason?.id === s.id ? 'bg-white text-black shadow-lg' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                  {s.name}<span className="ml-1.5 text-xs opacity-60">({s.episodeCount})</span></button>))}
            </div>
            {loadingEps ? <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 skeleton" />)}</div> :
              <div className="grid gap-3">{episodes.map(ep => <EpisodeCard key={ep.id} ep={ep} onPlay={(id) => { setPlayEpisodeId(id); setShowPlayer(true); }} />)}
                {episodes.length === 0 && <div className="text-center py-12 text-gray-600"><Film className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>Aucun episode disponible</p></div>}</div>}
          </div>)}

        {/* SAGA / COLLECTION */}
        {collection && collectionItems.length > 0 && (
          <div className="mt-14">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" /> {collection.name}</h2>
            {collection.overview && <p className="text-gray-500 text-sm mb-6 max-w-2xl">{collection.overview}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {collectionItems.map((ci, idx) => (
                <motion.div key={ci.id || idx} whileHover={{ scale: 1.05, y: -4 }}
                  className={`cursor-pointer ${ci.isCurrent ? 'ring-2 ring-red-500 rounded-2xl' : ''}`}
                  onClick={() => { if (!ci.isCurrent) onItemClick(ci); }}>
                  <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-white/3 relative shadow-lg">
                    {ci.posterUrl ? <img src={ci.posterUrl} alt={ci.name} className="w-full h-full object-cover" loading="lazy" /> :
                      <div className="w-full h-full flex items-center justify-center"><Clapperboard className="w-8 h-8 text-gray-700" /></div>}
                    {ci.isCurrent && <div className="absolute inset-0 bg-red-600/10 flex items-center justify-center">
                      <Badge className="bg-red-600 text-white">Actuel</Badge></div>}
                  </div>
                  <p className="text-sm text-gray-400 mt-2 truncate font-medium">{ci.name}</p>
                  {ci.year && <p className="text-xs text-gray-600">{ci.year}</p>}
                </motion.div>))}
            </div>
          </div>)}

        {similar.length > 0 && <div className="mt-14"><MediaRow title="Similaire" items={similar}
          icon={<Film className="w-5 h-5 text-gray-500" />} onItemClick={onItemClick} /></div>}
      </div>
      <div className="h-24" />
    </motion.div>
  );
}

/* =================================================================
   SEARCH VIEW
   ================================================================= */

function SearchView({ query, onItemClick }) {
  const [results, setResults] = useState([]); const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(query);
  useEffect(() => { if (query) doSearch(query); }, [query]);
  const doSearch = async (q) => { setLoading(true); try { const r = await cachedApi(`search?q=${encodeURIComponent(q)}`); setResults(r.results || []); } catch {} setLoading(false); };
  const submit = (e) => { e.preventDefault(); if (searchInput.trim()) doSearch(searchInput.trim()); };
  return (
    <div className="pt-24 px-6 md:px-16 min-h-screen">
      <form onSubmit={submit} className="mb-10 max-w-2xl"><div className="relative">
        <Input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Rechercher..."
          className="bg-white/5 border-white/10 text-white h-14 pl-14 text-lg rounded-2xl" autoFocus />
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" /></div></form>
      {loading ? <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
        {Array.from({ length: 12 }).map((_, i) => <div key={i}><div className="aspect-[2/3] skeleton" /></div>)}</div>
       : results.length > 0 ? <>
        <p className="text-gray-500 mb-6 text-sm">{results.length} resultat(s)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
          {results.map((item, i) => <MediaCard key={item.id || i} item={item} onClick={onItemClick} />)}</div>
      </> : <div className="text-center py-24"><Search className="w-16 h-16 text-gray-800 mx-auto mb-4" />
        <h3 className="text-xl text-gray-500">Aucun resultat</h3></div>}
    </div>
  );
}

/* =================================================================
   DASHBOARD VIEW - Uses cached API calls
   ================================================================= */

function DashboardView({ user, onItemClick, onPlay, mediaType }) {
  const [recommendations, setRecommendations] = useState([]); const [latestMovies, setLatestMovies] = useState([]);
  const [latestSeries, setLatestSeries] = useState([]); const [trendingMovies, setTrendingMovies] = useState([]);
  const [trendingSeries, setTrendingSeries] = useState([]); const [heroItem, setHeroItem] = useState(null);
  const [loads, setLoads] = useState({ reco: true, movies: true, series: true, trendM: true, trendS: true });
  const heroRef = useRef(null);

  useEffect(() => { load(); }, [mediaType]);

  const load = async () => {
    const sl = (k, v) => setLoads(p => ({ ...p, [k]: v }));

    sl('reco', true);
    cachedApi('recommendations').then(r => {
      const recs = r.recommendations || [];
      setRecommendations(recs);
      if (recs.length > 0 && !heroRef.current) { heroRef.current = recs[0]; setHeroItem(recs[0]); }
      sl('reco', false);
    }).catch(() => sl('reco', false));

    if (!mediaType || mediaType === 'movies') {
      sl('movies', true);
      cachedApi('media/library?type=Movie&limit=20&sortBy=DateCreated&sortOrder=Descending').then(r => {
        const items = r.items || [];
        setLatestMovies(items);
        if (!heroRef.current && items.length > 0) { heroRef.current = items[0]; setHeroItem(items[0]); }
        sl('movies', false);
      }).catch(() => sl('movies', false));
    }

    if (!mediaType || mediaType === 'series') {
      sl('series', true);
      cachedApi('media/library?type=Series&limit=20&sortBy=DateCreated&sortOrder=Descending').then(r => {
        setLatestSeries(r.items || []); sl('series', false);
      }).catch(() => sl('series', false));
    }

    sl('trendM', true);
    cachedApi('discover?type=movies').then(r => { setTrendingMovies(r.results || []); sl('trendM', false); }).catch(() => sl('trendM', false));
    sl('trendS', true);
    cachedApi('discover?type=tv').then(r => { setTrendingSeries(r.results || []); sl('trendS', false); }).catch(() => sl('trendS', false));
  };

  return (
    <div className="min-h-screen">
      <HeroSection item={heroItem} onPlay={onPlay} onDetail={onItemClick} />
      <div className="-mt-12 relative z-10">
        <MediaRow title="Recommande pour vous" items={recommendations} icon={<Sparkles className="w-5 h-5 text-red-500" />} onItemClick={onItemClick} loading={loads.reco} size="large" />
        {(!mediaType || mediaType === 'movies') && <MediaRow title="Films recemment ajoutes" items={latestMovies} icon={<Film className="w-5 h-5 text-blue-400" />} onItemClick={onItemClick} loading={loads.movies} />}
        {(!mediaType || mediaType === 'series') && <MediaRow title="Series recemment ajoutees" items={latestSeries} icon={<Tv className="w-5 h-5 text-green-400" />} onItemClick={onItemClick} loading={loads.series} />}
        <MediaRow title="Tendances - Films" items={trendingMovies} icon={<TrendingUp className="w-5 h-5 text-orange-400" />} onItemClick={onItemClick} loading={loads.trendM} />
        <MediaRow title="Tendances - Series" items={trendingSeries} icon={<TrendingUp className="w-5 h-5 text-purple-400" />} onItemClick={onItemClick} loading={loads.trendS} />
      </div>
      <div className="h-20" />
    </div>
  );
}

/* =================================================================
   MAIN APP
   ================================================================= */

export default function App() {
  const [view, setView] = useState('loading'); const [user, setUser] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null); const [searchQuery, setSearchQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState(null); const [showGlobalPlayer, setShowGlobalPlayer] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    try {
      const s = await cachedApi('setup/check');
      if (!s.setupComplete) { setView('setup'); return; }
      const sess = await cachedApi('auth/session');
      if (sess.authenticated) { setUser(sess.user); setView(sess.onboardingComplete ? 'dashboard' : 'onboarding'); }
      else setView('login');
    } catch { setView('setup'); }
  };

  const handleLogin = (u, done) => { setUser(u); setView(done ? 'dashboard' : 'onboarding'); };
  const handleItemClick = (item) => { setSelectedItem(item); setView('detail'); window.scrollTo(0, 0); };
  const handlePlay = (item) => { setSelectedItem(item); setShowGlobalPlayer(true); };
  const handleSearch = (q) => { setSearchQuery(q); setView('search'); };
  const handleNav = (t) => {
    if (t === 'movies') setMediaTypeFilter('movies');
    else if (t === 'series') setMediaTypeFilter('series');
    else setMediaTypeFilter(null);
    setView('dashboard'); window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <AnimatePresence>{showGlobalPlayer && selectedItem && (
        <VideoPlayer item={selectedItem} onClose={() => setShowGlobalPlayer(false)} />)}</AnimatePresence>

      <AnimatePresence mode="wait">
        {view === 'loading' && <LoadingScreen key="loading" />}
        {view === 'setup' && <SetupView key="setup" onComplete={() => setView('login')} />}
        {view === 'login' && <LoginView key="login" onLogin={handleLogin} />}
        {view === 'onboarding' && <OnboardingView key="onboarding" onComplete={() => setView('dashboard')} />}
        {(view === 'dashboard' || view === 'search' || view === 'detail') && (
          <div key="main">
            <Navbar user={user} onSearch={handleSearch} onNavigate={handleNav}
              currentView={view === 'dashboard' ? (mediaTypeFilter || 'dashboard') : view} />
            {view === 'dashboard' && <DashboardView user={user} onItemClick={handleItemClick} onPlay={handlePlay} mediaType={mediaTypeFilter} />}
            {view === 'search' && <SearchView query={searchQuery} onItemClick={handleItemClick} />}
            {view === 'detail' && selectedItem && <MediaDetailView item={selectedItem}
              onBack={() => { setView('dashboard'); window.scrollTo(0, 0); }} onPlay={handlePlay} onItemClick={handleItemClick} />}
          </div>)}
      </AnimatePresence>
    </div>
  );
}
