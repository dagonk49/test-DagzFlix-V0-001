'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Play, Download, Clock, Search, LogOut, Star, ChevronLeft,
  ChevronRight, Film, Tv, Heart, ThumbsDown, Check, X, Loader2,
  Server, Link2, Shield, ArrowRight, Eye, EyeOff, Home, TrendingUp,
  Sparkles, Info, AlertCircle, RefreshCw, Clapperboard, Youtube,
  ChevronDown, Pause, Volume2, VolumeX, Maximize, Minimize, Library,
  Layers, PlayCircle,
} from 'lucide-react';

/* =================================================================
   CONSTANTS & HELPERS
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

async function api(path, options = {}) {
  const res = await fetch(`/api/${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (options.raw) return res;
  return res.json();
}

/* =================================================================
   LOADING SCREEN
   ================================================================= */

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#050505]">
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
        <h1 className="text-6xl font-black tracking-tighter mb-6">
          <span className="text-red-600">DAGZ</span><span className="text-white">FLIX</span>
        </h1>
        <div className="flex items-center justify-center gap-1.5">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-2.5 h-2.5 bg-red-600 rounded-full"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/* =================================================================
   SETUP VIEW - Glassmorphism style
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
      if (res.success) { setTestResult({ type, ...res }); } else { setError(res.error || 'Connexion echouee'); }
    } catch (err) { setError('Erreur: ' + err.message); }
    setTesting(false);
  };

  const saveConfig = async () => {
    setSaving(true); setError('');
    try {
      const res = await api('setup/save', { method: 'POST', body: JSON.stringify({ jellyfinUrl, jellyfinApiKey, jellyseerrUrl, jellyseerrApiKey }) });
      if (res.success) onComplete(); else setError(res.error);
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <h1 className="text-7xl font-black tracking-tighter mb-3">
            <span className="text-red-600">DAGZ</span><span className="text-white">FLIX</span>
          </h1>
          <p className="text-gray-500 text-lg font-light">Configuration initiale</p>
        </motion.div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold transition-all duration-500 ${
                s === step ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 scale-110' :
                s < step ? 'bg-white/10 text-green-400' : 'bg-white/5 text-gray-600'
              }`}>
                {s < step ? <Check className="w-5 h-5" /> : s}
              </div>
              {s < 3 && <div className={`w-14 h-[2px] rounded-full transition-all ${s < step ? 'bg-green-500/50' : 'bg-white/5'}`} />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              className="glass-strong rounded-3xl p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3.5 bg-purple-500/15 rounded-2xl"><Server className="w-6 h-6 text-purple-400" /></div>
                <div><h2 className="text-xl font-bold">Serveur Jellyfin</h2><p className="text-sm text-gray-500">Votre serveur de streaming</p></div>
              </div>
              <div className="space-y-5">
                <div><Label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">URL du serveur *</Label>
                  <Input value={jellyfinUrl} onChange={e => setJellyfinUrl(e.target.value)} placeholder="https://jellyfin.example.com"
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-12 rounded-xl" /></div>
                <div><Label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Cle API (optionnelle)</Label>
                  <Input value={jellyfinApiKey} onChange={e => setJellyfinApiKey(e.target.value)} placeholder="Votre cle API"
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-12 rounded-xl" type="password" /></div>
                {testResult?.type === 'jellyfin' && (
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-400 text-sm flex items-center gap-2">
                    <Check className="w-4 h-4" /> Connecte: {testResult.serverName} (v{testResult.version})</div>)}
                {error && (<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />{error}</div>)}
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1 border-white/10 text-gray-300 hover:bg-white/5 h-12 rounded-xl"
                    onClick={() => testConnection('jellyfin')} disabled={!jellyfinUrl || testing}>
                    {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}Tester</Button>
                  <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white h-12 rounded-xl font-semibold"
                    onClick={() => { setStep(2); setError(''); setTestResult(null); }} disabled={!jellyfinUrl}>
                    Suivant <ArrowRight className="w-4 h-4 ml-2" /></Button>
                </div>
              </div>
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              className="glass-strong rounded-3xl p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3.5 bg-blue-500/15 rounded-2xl"><Download className="w-6 h-6 text-blue-400" /></div>
                <div><h2 className="text-xl font-bold">Jellyseerr</h2><p className="text-sm text-gray-500">Moteur de requetes (optionnel)</p></div>
              </div>
              <div className="space-y-5">
                <div><Label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">URL Jellyseerr</Label>
                  <Input value={jellyseerrUrl} onChange={e => setJellyseerrUrl(e.target.value)} placeholder="https://jellyseerr.example.com"
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-12 rounded-xl" /></div>
                <div><Label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Cle API Jellyseerr</Label>
                  <Input value={jellyseerrApiKey} onChange={e => setJellyseerrApiKey(e.target.value)} placeholder="Votre cle API"
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-12 rounded-xl" type="password" /></div>
                {testResult?.type === 'jellyseerr' && (
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-400 text-sm flex items-center gap-2">
                    <Check className="w-4 h-4" /> Jellyseerr v{testResult.version}</div>)}
                {error && (<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />{error}</div>)}
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="border-white/10 text-gray-300 hover:bg-white/5 h-12 rounded-xl"
                    onClick={() => { setStep(1); setError(''); }}><ChevronLeft className="w-4 h-4 mr-1" /> Retour</Button>
                  {jellyseerrUrl && <Button variant="outline" className="flex-1 border-white/10 text-gray-300 hover:bg-white/5 h-12 rounded-xl"
                    onClick={() => testConnection('jellyseerr')} disabled={testing}>
                    {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}Tester</Button>}
                  <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white h-12 rounded-xl font-semibold"
                    onClick={() => { setStep(3); setError(''); }}>Suivant <ArrowRight className="w-4 h-4 ml-2" /></Button>
                </div>
              </div>
            </motion.div>
          )}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              className="glass-strong rounded-3xl p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3.5 bg-green-500/15 rounded-2xl"><Shield className="w-6 h-6 text-green-400" /></div>
                <div><h2 className="text-xl font-bold">Confirmation</h2><p className="text-sm text-gray-500">Verifiez votre configuration</p></div>
              </div>
              <div className="space-y-4">
                <div className="p-5 bg-white/3 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2 text-purple-400 mb-2"><Server className="w-4 h-4" /><span className="font-semibold text-sm">Jellyfin</span></div>
                  <p className="text-sm text-gray-300 break-all">{jellyfinUrl}</p></div>
                <div className="p-5 bg-white/3 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2 text-blue-400 mb-2"><Download className="w-4 h-4" /><span className="font-semibold text-sm">Jellyseerr</span></div>
                  <p className="text-sm text-gray-300 break-all">{jellyseerrUrl || 'Non configure'}</p></div>
                {error && (<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">{error}</div>)}
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="border-white/10 text-gray-300 h-12 rounded-xl" onClick={() => setStep(2)}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Retour</Button>
                  <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white h-12 rounded-xl font-bold pulse-glow"
                    onClick={saveConfig} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                    Sauvegarder et Continuer</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* =================================================================
   LOGIN VIEW - Cinematic glassmorphism
   ================================================================= */

function LoginView({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const res = await api('auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      if (res.success) onLogin(res.user, res.onboardingComplete);
      else setError(res.error || 'Connexion echouee');
    } catch (err) { setError('Erreur reseau: ' + err.message); }
    setLoading(false);
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient light effects */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-900/20 rounded-full blur-[150px]" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-900/10 rounded-full blur-[120px]" />

      <div className="relative w-full max-w-md z-10">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h1 className="text-7xl font-black tracking-tighter mb-3">
            <span className="text-red-600">DAGZ</span><span className="text-white">FLIX</span>
          </h1>
          <p className="text-gray-500 font-light">Connectez-vous avec vos identifiants Jellyfin</p>
        </motion.div>

        <motion.form initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          onSubmit={handleLogin} className="glass-strong rounded-3xl p-10 space-y-6">
          <div>
            <Label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Nom d'utilisateur</Label>
            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Votre nom d'utilisateur"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-13 rounded-xl text-base" autoFocus />
          </div>
          <div>
            <Label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Mot de passe</Label>
            <div className="relative">
              <Input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'}
                placeholder="Votre mot de passe"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-13 rounded-xl text-base pr-12" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition-colors">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
            </div>
          </div>
          {error && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</motion.div>)}
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
  const [favorites, setFavorites] = useState([]);
  const [disliked, setDisliked] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggle = (genre, list, setList, otherList, setOtherList) => {
    if (otherList.includes(genre)) setOtherList(otherList.filter(g => g !== genre));
    if (list.includes(genre)) setList(list.filter(g => g !== genre));
    else setList([...list, genre]);
  };

  const handleSave = async () => {
    setSaving(true);
    await api('preferences', { method: 'POST', body: JSON.stringify({ favoriteGenres: favorites, dislikedGenres: disliked }) });
    setSaving(false); onComplete();
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="w-16 h-16 bg-red-600/15 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <Sparkles className="w-8 h-8 text-red-500" /></div>
          <h2 className="text-3xl font-bold mb-2">Bienvenue sur DagzFlix !</h2>
          <p className="text-gray-500">Personnalisez vos recommandations</p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="glass-strong rounded-3xl p-8 mb-6">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" /> Genres que vous adorez</h3>
          <div className="flex flex-wrap gap-2">
            {GENRE_LIST.map(g => (
              <button key={g} onClick={() => toggle(g, favorites, setFavorites, disliked, setDisliked)}
                className={`px-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300 ${
                  favorites.includes(g) ? 'bg-red-600 text-white shadow-lg shadow-red-600/20 scale-105' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}>{GENRE_EMOJIS[g] || ''} {g}</button>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="glass-strong rounded-3xl p-8 mb-8">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <ThumbsDown className="w-5 h-5 text-gray-500" /> Genres que vous evitez</h3>
          <div className="flex flex-wrap gap-2">
            {GENRE_LIST.map(g => (
              <button key={g} onClick={() => toggle(g, disliked, setDisliked, favorites, setFavorites)}
                className={`px-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300 ${
                  disliked.includes(g) ? 'bg-gray-600 text-white line-through' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}>{GENRE_EMOJIS[g] || ''} {g}</button>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <Button onClick={handleSave} disabled={saving}
            className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-bold text-lg rounded-2xl">
            {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
            Commencer</Button>
          <button onClick={onComplete} className="w-full mt-4 text-gray-600 hover:text-gray-400 text-sm transition-colors">
            Passer cette etape</button>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* =================================================================
   NAVBAR - Apple TV glass style
   ================================================================= */

function Navbar({ user, onSearch, onNavigate, currentView }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) { onSearch(searchQuery.trim()); setSearchOpen(false); }
  };

  const handleLogout = async () => { await api('auth/logout', { method: 'POST' }); window.location.reload(); };

  return (
    <motion.nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled ? 'bg-black/80 backdrop-blur-2xl shadow-2xl shadow-black/50' : 'bg-gradient-to-b from-black/60 to-transparent'
    }`}>
      <div className="max-w-[1800px] mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <button onClick={() => onNavigate('dashboard')} className="flex-shrink-0">
            <h1 className="text-2xl font-black tracking-tighter">
              <span className="text-red-600">DAGZ</span><span className="text-white">FLIX</span></h1></button>
          <div className="hidden md:flex items-center gap-1">
            {[{ id: 'dashboard', label: 'Accueil', icon: Home }, { id: 'movies', label: 'Films', icon: Film }, { id: 'series', label: 'Series', icon: Tv }].map(tab => (
              <button key={tab.id} onClick={() => onNavigate(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  currentView === tab.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}><tab.icon className="w-4 h-4" />{tab.label}</button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <AnimatePresence>
            {searchOpen ? (
              <motion.form key="search" initial={{ width: 0, opacity: 0 }} animate={{ width: 320, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                onSubmit={handleSearchSubmit} className="relative">
                <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..." className="bg-white/5 border-white/10 text-white h-10 pl-10 pr-10 rounded-xl" autoFocus />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
              </motion.form>
            ) : (
              <button onClick={() => setSearchOpen(true)} className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all">
                <Search className="w-5 h-5" /></button>
            )}
          </AnimatePresence>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-red-600/20">
            {user?.name?.[0]?.toUpperCase() || 'U'}</div>
          <button onClick={handleLogout} className="p-2 rounded-xl text-gray-500 hover:text-red-500 hover:bg-white/5 transition-all" title="Deconnexion">
            <LogOut className="w-4 h-4" /></button>
        </div>
      </div>
    </motion.nav>
  );
}

/* =================================================================
   MEDIA CARD - Apple TV style with glassmorphism
   ================================================================= */

function MediaCard({ item, onClick, size = 'normal' }) {
  const [imgError, setImgError] = useState(false);
  const widthClass = size === 'large' ? 'w-[220px] md:w-[260px]' : 'w-[160px] md:w-[185px]';

  return (
    <motion.div className={`flex-shrink-0 ${widthClass} cursor-pointer`} onClick={() => onClick(item)}
      whileHover={{ scale: 1.06, y: -8 }} transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}>
      <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-white/3 relative card-reflection group shadow-lg shadow-black/30">
        {!imgError && item.posterUrl ? (
          <img src={item.posterUrl} alt={item.name} className="w-full h-full object-cover" onError={() => setImgError(true)} loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-950">
            <Clapperboard className="w-10 h-10 text-gray-700" /></div>
        )}
        {/* Hover info */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-400 flex flex-col justify-end p-4">
          <p className="text-white font-semibold text-sm line-clamp-2">{item.name}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {item.year && <span className="text-gray-400 text-xs">{item.year}</span>}
            {(item.communityRating || item.voteAverage) > 0 && (
              <span className="flex items-center gap-1 text-yellow-400 text-xs">
                <Star className="w-3 h-3 fill-current" />{(item.communityRating || item.voteAverage || 0).toFixed(1)}</span>)}
          </div>
          {item.dagzRank !== undefined && item.dagzRank > 0 && (
            <div className="mt-1.5 flex items-center gap-1">
              <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full" style={{ width: `${item.dagzRank}%` }} /></div>
              <span className="text-red-400 text-[10px] font-bold">{item.dagzRank}%</span></div>)}
        </div>
        {/* Status badges */}
        {item.mediaStatus === 5 && (
          <div className="absolute top-2.5 right-2.5">
            <div className="bg-green-500/90 backdrop-blur text-white text-[10px] px-2 py-0.5 rounded-lg font-medium">Disponible</div></div>)}
        {(item.mediaStatus === 2 || item.mediaStatus === 3) && (
          <div className="absolute top-2.5 right-2.5">
            <div className="bg-yellow-500/90 backdrop-blur text-white text-[10px] px-2 py-0.5 rounded-lg font-medium">En cours</div></div>)}
      </div>
      <p className="text-gray-400 text-sm mt-2.5 truncate font-medium">{item.name}</p>
    </motion.div>
  );
}

/* =================================================================
   MEDIA ROW - Horizontal scrolling with Apple TV feel
   ================================================================= */

function MediaRow({ title, items, icon, onItemClick, loading, size }) {
  const scrollRef = useRef(null);
  const scroll = (dir) => { scrollRef.current?.scrollBy({ left: dir === 'left' ? -600 : 600, behavior: 'smooth' }); };

  if (!loading && (!items || items.length === 0)) return null;

  return (
    <div className="mb-12 group/row">
      <h3 className="text-lg font-bold text-white mb-5 px-6 md:px-10 flex items-center gap-2.5">
        {icon}{title}
        {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-600" />}
      </h3>
      <div className="relative">
        <button onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-8 z-10 w-14 bg-gradient-to-r from-[#050505] to-transparent hidden group-hover/row:flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"><ChevronLeft className="w-5 h-5 text-white" /></div></button>
        <button onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-8 z-10 w-14 bg-gradient-to-l from-[#050505] to-transparent hidden group-hover/row:flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"><ChevronRight className="w-5 h-5 text-white" /></div></button>
        <div ref={scrollRef} className="flex gap-4 overflow-x-auto hide-scrollbar px-6 md:px-10 pb-4">
          {loading ? Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`flex-shrink-0 ${size === 'large' ? 'w-[220px] md:w-[260px]' : 'w-[160px] md:w-[185px]'}`}>
              <div className="aspect-[2/3] skeleton" /><div className="h-4 w-20 skeleton mt-2.5" /></div>
          )) : (items || []).map((item, idx) => (
            <MediaCard key={item.id || idx} item={item} onClick={onItemClick} size={size} />))}
        </div>
      </div>
    </div>
  );
}

/* =================================================================
   HERO SECTION - Cinematic with glassmorphism overlay
   ================================================================= */

function HeroSection({ item, onPlay, onDetail }) {
  const [imgError, setImgError] = useState(false);

  if (!item) {
    return (
      <div className="relative h-[75vh] min-h-[550px] bg-gradient-to-b from-gray-900/50 to-[#050505] flex items-end">
        <div className="relative z-10 px-6 md:px-16 pb-24 max-w-3xl">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-4">
            <span className="text-red-600">DAGZ</span><span>FLIX</span></h1>
          <p className="text-xl text-gray-400 font-light">Votre plateforme de streaming unifiee.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[75vh] min-h-[550px]">
      {!imgError && item.backdropUrl ? (
        <img src={item.backdropUrl} alt={item.name} className="absolute inset-0 w-full h-full object-cover" onError={() => setImgError(true)} />
      ) : (<div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-[#050505]" />)}
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/30 to-[#050505]/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/90 via-[#050505]/30 to-transparent" />

      <div className="relative z-10 h-full flex items-end">
        <div className="px-6 md:px-16 pb-24 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            {item.dagzRank > 0 && (
              <div className="inline-flex items-center gap-1.5 bg-red-600/20 backdrop-blur-sm border border-red-500/20 text-red-300 rounded-full px-3 py-1 text-sm font-medium mb-4">
                <Sparkles className="w-3.5 h-3.5" /> Recommande a {item.dagzRank}%</div>)}
            <h1 className="text-4xl md:text-6xl font-black mb-4 leading-[1.1]">{item.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mb-4 text-sm text-gray-400">
              {item.year && <span>{item.year}</span>}
              {item.runtime > 0 && <span>{item.runtime} min</span>}
              {(item.communityRating || item.voteAverage) > 0 && (
                <span className="flex items-center gap-1 text-yellow-400">
                  <Star className="w-4 h-4 fill-current" />{(item.communityRating || item.voteAverage || 0).toFixed(1)}</span>)}
              {item.officialRating && (
                <span className="px-2 py-0.5 rounded-md border border-white/20 text-xs text-gray-300">{item.officialRating}</span>)}
            </div>
            <p className="text-gray-300 text-base mb-8 line-clamp-3 max-w-xl font-light leading-relaxed">{item.overview}</p>
            <div className="flex items-center gap-3">
              <Button onClick={() => onPlay(item)}
                className="bg-white hover:bg-gray-100 text-black font-bold px-8 h-13 text-base rounded-xl shadow-xl shadow-white/10">
                <Play className="w-5 h-5 mr-2 fill-current" /> Lecture</Button>
              <Button onClick={() => onDetail(item)} variant="outline"
                className="border-white/20 text-white hover:bg-white/10 h-13 px-6 rounded-xl backdrop-blur">
                <Info className="w-5 h-5 mr-2" /> Plus d'infos</Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* =================================================================
   SMART BUTTON
   ================================================================= */

function SmartButton({ item, onPlay }) {
  const [status, setStatus] = useState('loading');
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => { checkStatus(); }, [item?.id]);

  const checkStatus = async () => {
    if (!item) return; setStatus('loading');
    try {
      const params = new URLSearchParams();
      if (item.id) params.set('id', item.id);
      if (item.tmdbId || item.providerIds?.Tmdb) params.set('tmdbId', item.tmdbId || item.providerIds?.Tmdb || '');
      params.set('mediaType', item.type === 'Series' ? 'tv' : 'movie');
      const res = await api(`media/status?${params.toString()}`);
      setStatus(res.status || 'unknown');
    } catch { setStatus('unknown'); }
  };

  const handleRequest = async () => {
    setRequesting(true);
    try {
      const tmdbId = item.tmdbId || item.providerIds?.Tmdb;
      const res = await api('media/request', { method: 'POST',
        body: JSON.stringify({ tmdbId, mediaType: item.type === 'Series' ? 'tv' : 'movie' }) });
      if (res.success) { setRequested(true); setStatus('pending'); }
    } catch (e) { console.error(e); }
    setRequesting(false);
  };

  const baseClass = "h-13 px-8 text-base font-bold rounded-xl transition-all duration-300";

  if (status === 'loading') return (
    <Button className={`${baseClass} bg-white/5 text-gray-500`} disabled>
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Verification...</Button>);
  if (status === 'available' || status === 'partial') return (
    <Button onClick={() => onPlay(item)} className={`${baseClass} bg-white hover:bg-gray-100 text-black shadow-xl shadow-white/10`}>
      <Play className="w-5 h-5 mr-2 fill-current" /> LECTURE</Button>);
  if (status === 'pending') return (
    <Button className={`${baseClass} bg-yellow-500/10 text-yellow-400 border border-yellow-500/30`} disabled>
      <Clock className="w-5 h-5 mr-2" /> EN COURS D'ACQUISITION</Button>);
  return (
    <Button onClick={handleRequest} disabled={requesting || requested}
      className={`${baseClass} bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/20`}>
      {requesting ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Envoi...</> :
       requested ? <><Check className="w-5 h-5 mr-2" /> Demande envoyee</> :
       <><Download className="w-5 h-5 mr-2" /> DEMANDER</>}</Button>);
}

/* =================================================================
   TRAILER BUTTON & MODAL
   ================================================================= */

function TrailerButton({ item }) {
  const [trailers, setTrailers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchTrailers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (item.id) params.set('id', item.id);
      if (item.tmdbId || item.providerIds?.Tmdb) params.set('tmdbId', item.tmdbId || item.providerIds?.Tmdb || '');
      params.set('mediaType', item.type === 'Series' ? 'tv' : 'movie');
      const res = await api(`media/trailer?${params.toString()}`);
      setTrailers(res.trailers || []);
      if ((res.trailers || []).length > 0) setShowModal(true);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const getYoutubeId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  return (
    <>
      <Button onClick={fetchTrailers} disabled={loading} variant="outline"
        className="h-13 px-6 rounded-xl border-white/15 text-white hover:bg-white/5 backdrop-blur">
        {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Youtube className="w-5 h-5 mr-2 text-red-500" />}
        Bande-annonce</Button>

      <AnimatePresence>
        {showModal && trailers.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-4xl glass-strong rounded-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5">
                <h3 className="text-lg font-bold">Bande-annonce</h3>
                <button onClick={() => setShowModal(false)}
                  className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5" /></button>
              </div>
              <div className="aspect-video bg-black">
                {(() => {
                  const ytId = getYoutubeId(trailers[0]?.url) || trailers[0]?.key;
                  return ytId ? (
                    <iframe src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
                      className="w-full h-full" allowFullScreen allow="autoplay; encrypted-media" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      <a href={trailers[0]?.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-red-400 hover:text-red-300">
                        <Youtube className="w-8 h-8" /> Ouvrir la bande-annonce</a></div>
                  );
                })()}
              </div>
              {trailers.length > 1 && (
                <div className="p-5 flex gap-2 overflow-x-auto">
                  {trailers.map((t, i) => (
                    <button key={i} onClick={() => { const ytId = getYoutubeId(t.url) || t.key;
                      if (ytId) window.open(`https://www.youtube.com/watch?v=${ytId}`, '_blank'); }}
                      className="px-3 py-2 rounded-xl bg-white/5 text-sm text-gray-300 hover:bg-white/10 whitespace-nowrap flex-shrink-0">
                      {t.name || `Trailer ${i+1}`}</button>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* =================================================================
   VIDEO PLAYER
   ================================================================= */

function VideoPlayer({ item, episodeId, onClose }) {
  const [streamUrl, setStreamUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => { fetchStream(); }, []);

  const fetchStream = async () => {
    try {
      const id = episodeId || item?.id;
      if (!id) { setError('ID manquant'); setLoading(false); return; }
      const res = await api(`media/stream?id=${id}`);
      if (res.streamUrl) { setStreamUrl(res.streamUrl); }
      else { setError(res.error || 'Stream indisponible'); }
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true); }
    else { videoRef.current.pause(); setIsPlaying(false); }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else videoRef.current?.parentElement?.requestFullscreen();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
      {loading ? (
        <div className="text-center"><Loader2 className="w-12 h-12 animate-spin text-red-600 mx-auto mb-4" />
          <p className="text-gray-400">Chargement du flux...</p></div>
      ) : error ? (
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Lecture impossible</h3>
          <p className="text-gray-400 mb-6">{error}</p>
          <Button onClick={onClose} className="bg-white/10 hover:bg-white/20 rounded-xl">Fermer</Button></div>
      ) : (
        <div className="w-full h-full relative group">
          <video ref={videoRef} src={streamUrl} className="w-full h-full object-contain" autoPlay
            onClick={togglePlay} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />
          {/* Controls overlay */}
          <div className="absolute inset-0 player-overlay opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between">
            <div className="flex items-center justify-between p-6">
              <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center hover:bg-white/20">
                <ChevronLeft className="w-6 h-6" /></button>
              <h3 className="text-lg font-bold">{item?.name}</h3>
              <div className="w-10" />
            </div>
            <div className="flex items-center justify-center gap-6 pb-8">
              <button onClick={togglePlay} className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center hover:bg-white/30 transition-all">
                {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}</button>
            </div>
            <div className="flex items-center justify-end gap-3 p-6">
              <button onClick={toggleFullscreen} className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center hover:bg-white/20">
                <Maximize className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      )}
      {/* Close button always visible */}
      <button onClick={onClose}
        className="absolute top-6 left-6 z-10 w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center hover:bg-white/20 transition-all">
        <X className="w-5 h-5" /></button>
    </motion.div>
  );
}

/* =================================================================
   EPISODE CARD
   ================================================================= */

function EpisodeCard({ ep, onPlay }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}
      className="glass-card rounded-2xl overflow-hidden cursor-pointer group" onClick={() => onPlay(ep.id)}>
      <div className="flex gap-4 p-4">
        <div className="relative w-40 aspect-video rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
          {!imgErr && (ep.thumbUrl || ep.backdropUrl) ? (
            <img src={ep.thumbUrl || ep.backdropUrl} alt={ep.name} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><PlayCircle className="w-8 h-8 text-gray-600" /></div>
          )}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <Play className="w-5 h-5 fill-current" /></div>
          </div>
          {ep.isPlayed && <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-lg bg-green-500/80 flex items-center justify-center">
            <Check className="w-3 h-3" /></div>}
        </div>
        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500 font-mono">E{String(ep.episodeNumber).padStart(2, '0')}</span>
            {ep.runtime > 0 && <span className="text-xs text-gray-600">{ep.runtime} min</span>}
          </div>
          <h4 className="font-semibold text-white text-sm mb-1.5 truncate">{ep.name}</h4>
          <p className="text-gray-500 text-xs line-clamp-2 leading-relaxed">{ep.overview}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* =================================================================
   MEDIA DETAIL VIEW - Netflix x Apple TV with seasons/episodes/saga
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
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [playEpisodeId, setPlayEpisodeId] = useState(null);

  useEffect(() => { fetchAll(); }, [item]);

  const fetchAll = async () => {
    setLoading(true); setSeasons([]); setEpisodes([]); setCollection(null); setCollectionItems([]);

    // Fetch detail
    if (item.id && !item.tmdbId) {
      try {
        const res = await api(`media/detail?id=${item.id}`);
        if (res.item) { setDetail(res.item); setSimilar(res.similar || []); }
      } catch (e) { console.error(e); }
    } else { setDetail(item); }

    const displayItem = detail || item;

    // Fetch seasons for series
    if (displayItem?.type === 'Series' && displayItem?.id) {
      try {
        const res = await api(`media/seasons?seriesId=${displayItem.id}`);
        const s = res.seasons || [];
        setSeasons(s);
        if (s.length > 0) { setSelectedSeason(s[0]); fetchEpisodes(displayItem.id, s[0].id); }
      } catch (e) { console.error(e); }
    }

    // Fetch collection/saga for movies
    if (displayItem?.type === 'Movie' || displayItem?.type !== 'Series') {
      try {
        const params = new URLSearchParams();
        if (displayItem?.id) params.set('id', displayItem.id);
        if (displayItem?.tmdbId || displayItem?.providerIds?.Tmdb) params.set('tmdbId', displayItem.tmdbId || displayItem.providerIds?.Tmdb);
        const res = await api(`media/collection?${params.toString()}`);
        if (res.collection) { setCollection(res.collection); setCollectionItems(res.items || []); }
      } catch (e) { console.error(e); }
    }

    setLoading(false);
  };

  const fetchEpisodes = async (seriesId, seasonId) => {
    setLoadingEpisodes(true);
    try {
      const res = await api(`media/episodes?seriesId=${seriesId}&seasonId=${seasonId}`);
      setEpisodes(res.episodes || []);
    } catch (e) { console.error(e); }
    setLoadingEpisodes(false);
  };

  const handleSeasonChange = (season) => {
    setSelectedSeason(season);
    const d = detail || item;
    if (d?.id) fetchEpisodes(d.id, season.id);
  };

  const handlePlayEpisode = (episodeId) => {
    setPlayEpisodeId(episodeId);
    setShowPlayer(true);
  };

  const displayItem = detail || item;
  const isSeries = displayItem?.type === 'Series';

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="min-h-screen bg-[#050505]">
      {/* Video Player Overlay */}
      <AnimatePresence>
        {showPlayer && (
          <VideoPlayer item={displayItem} episodeId={playEpisodeId}
            onClose={() => { setShowPlayer(false); setPlayEpisodeId(null); }} />
        )}
      </AnimatePresence>

      {/* Backdrop */}
      <div className="relative h-[55vh] min-h-[400px]">
        {!imgError && displayItem?.backdropUrl ? (
          <img src={displayItem.backdropUrl} alt={displayItem.name} className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgError(true)} />
        ) : (<div className="absolute inset-0 bg-gradient-to-br from-red-950/20 via-gray-900 to-[#050505]" />)}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/50 to-[#050505]/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/80 to-transparent" />

        <button onClick={onBack}
          className="absolute top-20 left-6 z-20 w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center hover:bg-white/20 transition-all">
          <ChevronLeft className="w-5 h-5" /></button>
      </div>

      {/* Content */}
      <div className="relative -mt-56 z-10 px-6 md:px-16 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row gap-10">
          {/* Poster */}
          <div className="flex-shrink-0 w-48 md:w-56">
            <div className="aspect-[2/3] rounded-3xl overflow-hidden shadow-2xl shadow-black/60 bg-white/5 ring-1 ring-white/10">
              {displayItem?.posterUrl ? (
                <img src={displayItem.posterUrl} alt={displayItem.name} className="w-full h-full object-cover"
                  onError={e => e.target.style.display = 'none'} />
              ) : (<div className="w-full h-full flex items-center justify-center"><Clapperboard className="w-16 h-16 text-gray-700" /></div>)}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 pt-4">
            <h1 className="text-3xl md:text-5xl font-black mb-4 leading-tight">{displayItem?.name}</h1>

            <div className="flex flex-wrap items-center gap-2.5 mb-5">
              {displayItem?.year && (
                <span className="px-3 py-1.5 rounded-xl bg-white/5 text-gray-300 text-sm">{displayItem.year}</span>)}
              {displayItem?.runtime > 0 && (
                <span className="px-3 py-1.5 rounded-xl bg-white/5 text-gray-300 text-sm flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> {displayItem.runtime} min</span>)}
              {(displayItem?.communityRating || displayItem?.voteAverage) > 0 && (
                <span className="px-3 py-1.5 rounded-xl bg-yellow-500/10 text-yellow-400 text-sm flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 fill-current" /> {(displayItem.communityRating || displayItem.voteAverage || 0).toFixed(1)}</span>)}
              {displayItem?.officialRating && (
                <span className="px-3 py-1.5 rounded-xl bg-white/5 text-gray-300 text-sm">{displayItem.officialRating}</span>)}
              <span className="px-3 py-1.5 rounded-xl bg-white/5 text-gray-300 text-sm flex items-center gap-1.5">
                {isSeries ? <><Tv className="w-3.5 h-3.5" /> Serie</> : <><Film className="w-3.5 h-3.5" /> Film</>}</span>
              {isSeries && seasons.length > 0 && (
                <span className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-300 text-sm flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> {seasons.length} saison{seasons.length > 1 ? 's' : ''}</span>)}
            </div>

            {/* Genres */}
            {(displayItem?.genres || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {displayItem.genres.map(g => (
                  <span key={g} className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-300 text-sm border border-red-500/10">
                    {GENRE_EMOJIS[g] || ''} {g}</span>))}
              </div>)}

            {/* DagzRank */}
            {displayItem?.dagzRank > 0 && (
              <div className="mb-5 inline-flex items-center gap-3 glass rounded-2xl px-5 py-3">
                <Sparkles className="w-5 h-5 text-red-400" />
                <span className="text-red-300 font-bold">DagzRank</span>
                <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full" style={{ width: `${displayItem.dagzRank}%` }} /></div>
                <span className="text-red-400 font-bold">{displayItem.dagzRank}%</span>
              </div>)}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3 mb-8">
              <SmartButton item={displayItem} onPlay={() => setShowPlayer(true)} />
              <TrailerButton item={displayItem} />
            </div>

            {/* Overview */}
            <p className="text-gray-400 leading-relaxed mb-8 max-w-2xl font-light">{displayItem?.overview}</p>

            {/* Cast */}
            {(displayItem?.people || []).length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Distribution</h3>
                <div className="flex flex-wrap gap-2">
                  {displayItem.people.filter(p => p.type === 'Actor').slice(0, 8).map((p, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-xl bg-white/3 text-gray-300 text-sm border border-white/5">
                      {p.name}</span>))}
                </div>
              </div>)}
          </div>
        </div>

        {/* =================== SEASONS & EPISODES (Series only) =================== */}
        {isSeries && seasons.length > 0 && (
          <div className="mt-14">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400" /> Saisons et Episodes</h2>

            {/* Season selector */}
            <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar pb-2">
              {seasons.map(s => (
                <button key={s.id} onClick={() => handleSeasonChange(s)}
                  className={`px-5 py-2.5 rounded-2xl text-sm font-medium transition-all whitespace-nowrap ${
                    selectedSeason?.id === s.id
                      ? 'bg-white text-black shadow-lg shadow-white/10'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}>
                  {s.name}
                  <span className="ml-1.5 text-xs opacity-60">({s.episodeCount})</span>
                </button>
              ))}
            </div>

            {/* Episodes grid */}
            {loadingEpisodes ? (
              <div className="grid gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-28 skeleton" />))}
              </div>
            ) : (
              <div className="grid gap-3">
                {episodes.map(ep => (
                  <EpisodeCard key={ep.id} ep={ep} onPlay={handlePlayEpisode} />
                ))}
                {episodes.length === 0 && (
                  <div className="text-center py-12 text-gray-600">
                    <Film className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Aucun episode disponible pour cette saison</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* =================== SAGA / COLLECTION (Movies only) =================== */}
        {collection && collectionItems.length > 0 && (
          <div className="mt-14">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Library className="w-5 h-5 text-amber-400" /> {collection.name}</h2>
            {collection.overview && (
              <p className="text-gray-500 text-sm mb-6 max-w-2xl">{collection.overview}</p>)}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {collectionItems.map((ci, idx) => (
                <motion.div key={ci.id || idx} whileHover={{ scale: 1.05, y: -4 }}
                  className={`cursor-pointer group ${ci.isCurrent ? 'ring-2 ring-red-500 rounded-2xl' : ''}`}
                  onClick={() => !ci.isCurrent && onItemClick(ci)}>
                  <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-white/3 relative shadow-lg">
                    {ci.posterUrl ? (
                      <img src={ci.posterUrl} alt={ci.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Clapperboard className="w-8 h-8 text-gray-700" /></div>)}
                    {ci.isCurrent && (
                      <div className="absolute inset-0 bg-red-600/10 flex items-center justify-center">
                        <Badge className="bg-red-600 text-white">Actuel</Badge></div>)}
                  </div>
                  <p className="text-sm text-gray-400 mt-2 truncate font-medium">{ci.name}</p>
                  {ci.year && <p className="text-xs text-gray-600">{ci.year}</p>}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Similar */}
        {similar.length > 0 && (
          <div className="mt-14">
            <MediaRow title="Similaire" items={similar}
              icon={<Film className="w-5 h-5 text-gray-500" />} onItemClick={onItemClick} />
          </div>
        )}
      </div>

      <div className="h-24" />
    </motion.div>
  );
}

/* =================================================================
   SEARCH VIEW
   ================================================================= */

function SearchView({ query, onItemClick }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(query);

  useEffect(() => { if (query) search(query); }, [query]);

  const search = async (q) => {
    setLoading(true);
    try { const res = await api(`search?q=${encodeURIComponent(q)}`); setResults(res.results || []); }
    catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSubmit = (e) => { e.preventDefault(); if (searchInput.trim()) search(searchInput.trim()); };

  return (
    <div className="pt-24 px-6 md:px-16 min-h-screen">
      <form onSubmit={handleSubmit} className="mb-10 max-w-2xl">
        <div className="relative">
          <Input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Rechercher un film, une serie..."
            className="bg-white/5 border-white/10 text-white h-14 pl-14 text-lg rounded-2xl" autoFocus />
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        </div>
      </form>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}><div className="aspect-[2/3] skeleton" /><div className="h-4 w-20 skeleton mt-2.5" /></div>))}
        </div>
      ) : results.length > 0 ? (
        <>
          <p className="text-gray-500 mb-6 text-sm">{results.length} resultat(s) pour &quot;{query}&quot;</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
            {results.map((item, idx) => (
              <MediaCard key={item.id || idx} item={item} onClick={onItemClick} />))}
          </div>
        </>
      ) : (
        <div className="text-center py-24">
          <Search className="w-16 h-16 text-gray-800 mx-auto mb-4" />
          <h3 className="text-xl text-gray-500">Aucun resultat pour &quot;{query}&quot;</h3>
        </div>
      )}
    </div>
  );
}

/* =================================================================
   DASHBOARD VIEW
   ================================================================= */

function DashboardView({ user, onItemClick, onPlay, mediaType }) {
  const [recommendations, setRecommendations] = useState([]);
  const [latestMovies, setLatestMovies] = useState([]);
  const [latestSeries, setLatestSeries] = useState([]);
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [trendingSeries, setTrendingSeries] = useState([]);
  const [heroItem, setHeroItem] = useState(null);
  const [loads, setLoads] = useState({ reco: true, movies: true, series: true, trendM: true, trendS: true });

  useEffect(() => { loadDashboard(); }, [mediaType]);

  const loadDashboard = async () => {
    const sl = (k, v) => setLoads(p => ({ ...p, [k]: v }));

    sl('reco', true);
    api('recommendations').then(r => {
      const recs = r.recommendations || [];
      setRecommendations(recs);
      if (recs.length > 0) setHeroItem(recs[0]);
      sl('reco', false);
    }).catch(() => sl('reco', false));

    if (!mediaType || mediaType === 'movies') {
      sl('movies', true);
      api('media/library?type=Movie&limit=20&sortBy=DateCreated&sortOrder=Descending').then(r => {
        setLatestMovies(r.items || []);
        if (!heroItem && (r.items || []).length > 0) setHeroItem(r.items[0]);
        sl('movies', false);
      }).catch(() => sl('movies', false));
    }

    if (!mediaType || mediaType === 'series') {
      sl('series', true);
      api('media/library?type=Series&limit=20&sortBy=DateCreated&sortOrder=Descending').then(r => {
        setLatestSeries(r.items || []); sl('series', false);
      }).catch(() => sl('series', false));
    }

    sl('trendM', true);
    api('discover?type=movies').then(r => { setTrendingMovies(r.results || []); sl('trendM', false); }).catch(() => sl('trendM', false));
    sl('trendS', true);
    api('discover?type=tv').then(r => { setTrendingSeries(r.results || []); sl('trendS', false); }).catch(() => sl('trendS', false));
  };

  return (
    <div className="min-h-screen">
      <HeroSection item={heroItem} onPlay={onPlay} onDetail={onItemClick} />

      <div className="-mt-12 relative z-10">
        <MediaRow title="Recommande pour vous" items={recommendations}
          icon={<Sparkles className="w-5 h-5 text-red-500" />} onItemClick={onItemClick} loading={loads.reco} size="large" />

        {(!mediaType || mediaType === 'movies') && (
          <MediaRow title="Films recemment ajoutes" items={latestMovies}
            icon={<Film className="w-5 h-5 text-blue-400" />} onItemClick={onItemClick} loading={loads.movies} />)}

        {(!mediaType || mediaType === 'series') && (
          <MediaRow title="Series recemment ajoutees" items={latestSeries}
            icon={<Tv className="w-5 h-5 text-green-400" />} onItemClick={onItemClick} loading={loads.series} />)}

        <MediaRow title="Tendances - Films" items={trendingMovies}
          icon={<TrendingUp className="w-5 h-5 text-orange-400" />} onItemClick={onItemClick} loading={loads.trendM} />

        <MediaRow title="Tendances - Series" items={trendingSeries}
          icon={<TrendingUp className="w-5 h-5 text-purple-400" />} onItemClick={onItemClick} loading={loads.trendS} />
      </div>

      <div className="h-20" />
    </div>
  );
}

/* =================================================================
   MAIN APP
   ================================================================= */

export default function App() {
  const [view, setView] = useState('loading');
  const [user, setUser] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState(null);
  const [showPlayer, setShowPlayer] = useState(false);

  useEffect(() => { checkInitialState(); }, []);

  const checkInitialState = async () => {
    try {
      const setupRes = await api('setup/check');
      if (!setupRes.setupComplete) { setView('setup'); return; }
      const sessionRes = await api('auth/session');
      if (sessionRes.authenticated) {
        setUser(sessionRes.user);
        setView(sessionRes.onboardingComplete ? 'dashboard' : 'onboarding');
      } else { setView('login'); }
    } catch { setView('setup'); }
  };

  const handleLogin = (userData, onboardingDone) => {
    setUser(userData);
    setView(onboardingDone ? 'dashboard' : 'onboarding');
  };

  const handleItemClick = (item) => { setSelectedItem(item); setView('detail'); window.scrollTo(0, 0); };
  const handlePlay = (item) => { setSelectedItem(item); setShowPlayer(true); };
  const handleSearch = (q) => { setSearchQuery(q); setView('search'); };
  const handleNavigate = (target) => {
    if (target === 'dashboard') { setMediaTypeFilter(null); setView('dashboard'); }
    else if (target === 'movies') { setMediaTypeFilter('movies'); setView('dashboard'); }
    else if (target === 'series') { setMediaTypeFilter('series'); setView('dashboard'); }
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Global Video Player */}
      <AnimatePresence>
        {showPlayer && selectedItem && (
          <VideoPlayer item={selectedItem} onClose={() => setShowPlayer(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {view === 'loading' && <LoadingScreen key="loading" />}
        {view === 'setup' && <SetupView key="setup" onComplete={() => setView('login')} />}
        {view === 'login' && <LoginView key="login" onLogin={handleLogin} />}
        {view === 'onboarding' && <OnboardingView key="onboarding" onComplete={() => setView('dashboard')} />}

        {(view === 'dashboard' || view === 'search' || view === 'detail') && (
          <div key="main">
            <Navbar user={user} onSearch={handleSearch} onNavigate={handleNavigate}
              currentView={view === 'dashboard' ? (mediaTypeFilter || 'dashboard') : view} />

            {view === 'dashboard' && (
              <DashboardView user={user} onItemClick={handleItemClick} onPlay={handlePlay} mediaType={mediaTypeFilter} />)}

            {view === 'search' && (
              <SearchView query={searchQuery} onItemClick={handleItemClick} />)}

            {view === 'detail' && selectedItem && (
              <MediaDetailView item={selectedItem}
                onBack={() => { setView('dashboard'); window.scrollTo(0, 0); }}
                onPlay={handlePlay} onItemClick={handleItemClick} />)}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
