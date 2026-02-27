'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Play, Download, Clock, Search, LogOut, Settings, Star, ChevronLeft,
  ChevronRight, Film, Tv, Heart, ThumbsDown, Check, X, Loader2,
  Server, Link2, Shield, ArrowRight, Eye, EyeOff, Home, TrendingUp,
  Sparkles, Info, Volume2, VolumeX, AlertCircle, RefreshCw, Clapperboard,
} from 'lucide-react';

/* =================================================================
   CONSTANTS
   ================================================================= */

const GENRE_LIST = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music',
  'Mystery', 'Romance', 'Science Fiction', 'Thriller', 'War', 'Western',
];

const GENRE_EMOJIS = {
  Action: '💥', Adventure: '🗺️', Animation: '🎨', Comedy: '😂',
  Crime: '🔍', Documentary: '📹', Drama: '🎭', Family: '👨‍👩‍👧‍👦',
  Fantasy: '🧙', History: '📜', Horror: '👻', Music: '🎵',
  Mystery: '🕵️', Romance: '💕', 'Science Fiction': '🚀',
  Thriller: '😰', War: '⚔️', Western: '🤠',
};

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
};

/* =================================================================
   API HELPER
   ================================================================= */

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
    <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <h1 className="text-5xl font-black tracking-tighter mb-4">
          <span className="text-red-600">DAGZ</span>
          <span className="text-white">FLIX</span>
        </h1>
        <Loader2 className="w-8 h-8 animate-spin text-red-600 mx-auto" />
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
    setTesting(true);
    setTestResult(null);
    setError('');
    try {
      const url = type === 'jellyfin' ? jellyfinUrl : jellyseerrUrl;
      const apiKey = type === 'jellyfin' ? jellyfinApiKey : jellyseerrApiKey;
      const res = await api('setup/test', {
        method: 'POST',
        body: JSON.stringify({ type, url, apiKey }),
      });
      if (res.success) {
        setTestResult({ type, ...res });
      } else {
        setError(res.error || 'Connexion echouee');
      }
    } catch (err) {
      setError('Erreur de connexion: ' + err.message);
    }
    setTesting(false);
  };

  const saveConfig = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api('setup/save', {
        method: 'POST',
        body: JSON.stringify({ jellyfinUrl, jellyfinApiKey, jellyseerrUrl, jellyseerrApiKey }),
      });
      if (res.success) {
        onComplete();
      } else {
        setError(res.error || 'Sauvegarde echouee');
      }
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4"
    >
      <div className="w-full max-w-lg">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-6xl font-black tracking-tighter mb-2">
            <span className="text-red-600">DAGZ</span>
            <span className="text-white">FLIX</span>
          </h1>
          <p className="text-gray-400 text-lg">Configuration initiale</p>
        </motion.div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                s === step ? 'bg-red-600 text-white scale-110' : s < step ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-500'
              }`}>
                {s < step ? <Check className="w-5 h-5" /> : s}
              </div>
              {s < 3 && <div className={`w-12 h-0.5 ${s < step ? 'bg-green-600' : 'bg-gray-800'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Jellyfin */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-600/20 rounded-lg">
                <Server className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Serveur Jellyfin</h2>
                <p className="text-sm text-gray-400">Votre serveur de streaming</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-gray-300 mb-2 block">URL du serveur *</Label>
                <Input
                  value={jellyfinUrl}
                  onChange={e => setJellyfinUrl(e.target.value)}
                  placeholder="https://jellyfin.example.com"
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
              <div>
                <Label className="text-gray-300 mb-2 block">Cle API (optionnelle)</Label>
                <Input
                  value={jellyfinApiKey}
                  onChange={e => setJellyfinApiKey(e.target.value)}
                  placeholder="Votre cle API Jellyfin"
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  type="password"
                />
              </div>

              {testResult?.type === 'jellyfin' && (
                <div className="p-3 bg-green-900/30 border border-green-800 rounded-lg text-green-400 text-sm">
                  <Check className="w-4 h-4 inline mr-2" />
                  Connecte: {testResult.serverName} (v{testResult.version})
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 inline mr-2" />{error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                  onClick={() => testConnection('jellyfin')}
                  disabled={!jellyfinUrl || testing}
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
                  Tester
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => { setStep(2); setError(''); setTestResult(null); }}
                  disabled={!jellyfinUrl}
                >
                  Suivant <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Jellyseerr */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-600/20 rounded-lg">
                <Download className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Jellyseerr</h2>
                <p className="text-sm text-gray-400">Moteur de requetes (optionnel)</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-gray-300 mb-2 block">URL Jellyseerr</Label>
                <Input
                  value={jellyseerrUrl}
                  onChange={e => setJellyseerrUrl(e.target.value)}
                  placeholder="https://jellyseerr.example.com"
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
              <div>
                <Label className="text-gray-300 mb-2 block">Cle API Jellyseerr</Label>
                <Input
                  value={jellyseerrApiKey}
                  onChange={e => setJellyseerrApiKey(e.target.value)}
                  placeholder="Votre cle API Jellyseerr"
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  type="password"
                />
              </div>

              {testResult?.type === 'jellyseerr' && (
                <div className="p-3 bg-green-900/30 border border-green-800 rounded-lg text-green-400 text-sm">
                  <Check className="w-4 h-4 inline mr-2" />
                  Connecte: Jellyseerr v{testResult.version}
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 inline mr-2" />{error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                  onClick={() => { setStep(1); setError(''); setTestResult(null); }}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Retour
                </Button>
                {jellyseerrUrl && (
                  <Button
                    variant="outline"
                    className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                    onClick={() => testConnection('jellyseerr')}
                    disabled={testing}
                  >
                    {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
                    Tester
                  </Button>
                )}
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => { setStep(3); setError(''); setTestResult(null); }}
                >
                  Suivant <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-green-600/20 rounded-lg">
                <Shield className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Confirmation</h2>
                <p className="text-sm text-gray-400">Verifiez votre configuration</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-2 text-purple-400 mb-2">
                  <Server className="w-4 h-4" />
                  <span className="font-semibold">Jellyfin</span>
                </div>
                <p className="text-sm text-gray-300 break-all">{jellyfinUrl}</p>
                <p className="text-xs text-gray-500 mt-1">API Key: {jellyfinApiKey ? '••••••••' : 'Non configuree'}</p>
              </div>

              <div className="p-4 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-2 text-blue-400 mb-2">
                  <Download className="w-4 h-4" />
                  <span className="font-semibold">Jellyseerr</span>
                </div>
                <p className="text-sm text-gray-300 break-all">{jellyseerrUrl || 'Non configure'}</p>
                <p className="text-xs text-gray-500 mt-1">API Key: {jellyseerrApiKey ? '••••••••' : 'Non configuree'}</p>
              </div>

              {error && (
                <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 inline mr-2" />{error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                  onClick={() => setStep(2)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Retour
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white pulse-red"
                  onClick={saveConfig}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  Sauvegarder et Continuer
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        <p className="text-center text-gray-600 text-xs mt-8">
          Les informations sont stockees de maniere securisee sur le serveur.
        </p>
      </div>
    </motion.div>
  );
}

/* =================================================================
   LOGIN VIEW
   ================================================================= */

function LoginView({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api('auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (res.success) {
        onLogin(res.user, res.onboardingComplete);
      } else {
        setError(res.error || 'Connexion echouee');
      }
    } catch (err) {
      setError('Erreur reseau: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4"
    >
      {/* Background effect */}
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-red-900/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-purple-900/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-6xl font-black tracking-tighter mb-2">
            <span className="text-red-600">DAGZ</span>
            <span className="text-white">FLIX</span>
          </h1>
          <p className="text-gray-400">Connectez-vous avec vos identifiants Jellyfin</p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onSubmit={handleLogin}
          className="bg-gray-900/60 backdrop-blur-lg border border-gray-800 rounded-xl p-8 space-y-5"
        >
          <div>
            <Label className="text-gray-300 mb-2 block">Nom d'utilisateur</Label>
            <Input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Votre nom d'utilisateur"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 h-12"
              autoFocus
            />
          </div>

          <div>
            <Label className="text-gray-300 mb-2 block">Mot de passe</Label>
            <div className="relative">
              <Input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type={showPassword ? 'text' : 'password'}
                placeholder="Votre mot de passe"
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 h-12 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm"
            >
              <AlertCircle className="w-4 h-4 inline mr-2" />{error}
            </motion.div>
          )}

          <Button
            type="submit"
            className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold text-lg"
            disabled={loading || !username || !password}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Se connecter'
            )}
          </Button>
        </motion.form>
      </div>
    </motion.div>
  );
}

/* =================================================================
   ONBOARDING VIEW - Genre Selection
   ================================================================= */

function OnboardingView({ onComplete }) {
  const [favorites, setFavorites] = useState([]);
  const [disliked, setDisliked] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggleGenre = (genre, list, setList) => {
    if (list.includes(genre)) {
      setList(list.filter(g => g !== genre));
    } else {
      setList([...list, genre]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api('preferences', {
        method: 'POST',
        body: JSON.stringify({ favoriteGenres: favorites, dislikedGenres: disliked }),
      });
      onComplete();
    } catch (err) {
      console.error('Preferences save error:', err);
    }
    setSaving(false);
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4"
    >
      <div className="w-full max-w-2xl">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <Sparkles className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-2">Bienvenue sur DagzFlix !</h2>
          <p className="text-gray-400">Dites-nous ce que vous aimez pour personnaliser vos recommandations</p>
        </motion.div>

        {/* Favorite genres */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" /> Genres que vous adorez
          </h3>
          <div className="flex flex-wrap gap-2">
            {GENRE_LIST.map(genre => {
              const isFav = favorites.includes(genre);
              const isDis = disliked.includes(genre);
              return (
                <button
                  key={genre}
                  onClick={() => {
                    if (isDis) setDisliked(disliked.filter(g => g !== genre));
                    toggleGenre(genre, favorites, setFavorites);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    isFav
                      ? 'bg-red-600 text-white ring-2 ring-red-400 scale-105'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {GENRE_EMOJIS[genre] || ''} {genre}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Disliked genres */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ThumbsDown className="w-5 h-5 text-gray-500" /> Genres que vous evitez
          </h3>
          <div className="flex flex-wrap gap-2">
            {GENRE_LIST.map(genre => {
              const isFav = favorites.includes(genre);
              const isDis = disliked.includes(genre);
              return (
                <button
                  key={genre}
                  onClick={() => {
                    if (isFav) setFavorites(favorites.filter(g => g !== genre));
                    toggleGenre(genre, disliked, setDisliked);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    isDis
                      ? 'bg-gray-600 text-white ring-2 ring-gray-400 line-through'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {GENRE_EMOJIS[genre] || ''} {genre}
                </button>
              );
            })}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-bold text-lg"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
            Commencer a regarder
          </Button>
          <button onClick={onComplete} className="w-full mt-3 text-gray-500 hover:text-gray-300 text-sm">
            Passer cette etape
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* =================================================================
   NAVBAR
   ================================================================= */

function Navbar({ user, onSearch, onNavigate, currentView }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
      setSearchOpen(false);
    }
  };

  const handleLogout = async () => {
    await api('auth/logout', { method: 'POST' });
    window.location.reload();
  };

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-black/95 backdrop-blur shadow-xl' : 'bg-gradient-to-b from-black/80 to-transparent'
      }`}
    >
      <div className="max-w-[1800px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-8">
          <button onClick={() => onNavigate('dashboard')} className="flex-shrink-0">
            <h1 className="text-2xl font-black tracking-tighter">
              <span className="text-red-600">DAGZ</span>
              <span className="text-white">FLIX</span>
            </h1>
          </button>
          <div className="hidden md:flex items-center gap-6">
            <button
              onClick={() => onNavigate('dashboard')}
              className={`text-sm font-medium transition-colors ${
                currentView === 'dashboard' ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Accueil
            </button>
            <button
              onClick={() => onNavigate('movies')}
              className={`text-sm font-medium transition-colors ${
                currentView === 'movies' ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Films
            </button>
            <button
              onClick={() => onNavigate('series')}
              className={`text-sm font-medium transition-colors ${
                currentView === 'series' ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Series
            </button>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          {searchOpen ? (
            <motion.form
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              onSubmit={handleSearchSubmit}
              className="relative"
            >
              <Input
                ref={searchRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher un film, une serie..."
                className="bg-gray-900 border-gray-700 text-white h-9 pl-10 pr-10"
                autoFocus
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <button
                type="button"
                onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.form>
          ) : (
            <button onClick={() => setSearchOpen(true)} className="text-gray-300 hover:text-white">
              <Search className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-red-600 flex items-center justify-center text-white font-bold text-sm">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors" title="Deconnexion">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}

/* =================================================================
   MEDIA CARD
   ================================================================= */

function MediaCard({ item, onClick }) {
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      className="flex-shrink-0 w-[180px] md:w-[200px] cursor-pointer group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(item)}
      whileHover={{ scale: 1.05, zIndex: 10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 relative">
        {!imgError && item.posterUrl ? (
          <img
            src={item.posterUrl}
            alt={item.name}
            className="w-full h-full object-cover transition-all duration-300"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <Clapperboard className="w-12 h-12 text-gray-600" />
          </div>
        )}

        {/* Hover overlay */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-3"
            >
              <p className="text-white font-semibold text-sm line-clamp-2">{item.name}</p>
              <div className="flex items-center gap-2 mt-1">
                {item.year && <span className="text-gray-300 text-xs">{item.year}</span>}
                {(item.communityRating || item.voteAverage) > 0 && (
                  <span className="flex items-center gap-1 text-yellow-400 text-xs">
                    <Star className="w-3 h-3" />
                    {(item.communityRating || item.voteAverage || 0).toFixed(1)}
                  </span>
                )}
              </div>
              {item.dagzRank !== undefined && (
                <div className="mt-1">
                  <span className="text-red-400 text-xs font-bold">DagzRank: {item.dagzRank}%</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status badge */}
        {item.mediaStatus === 5 && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0.5">Disponible</Badge>
          </div>
        )}
        {(item.mediaStatus === 2 || item.mediaStatus === 3) && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-yellow-600 text-white text-[10px] px-1.5 py-0.5">En cours</Badge>
          </div>
        )}
      </div>
      <p className="text-gray-300 text-sm mt-2 truncate">{item.name}</p>
    </motion.div>
  );
}

/* =================================================================
   MEDIA ROW - Horizontal scrolling row
   ================================================================= */

function MediaRow({ title, items, icon, onItemClick, loading }) {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -600 : 600;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  if (!loading && (!items || items.length === 0)) return null;

  return (
    <div className="mb-10 group/row">
      <h3 className="text-xl font-bold text-white mb-4 px-4 md:px-8 flex items-center gap-2">
        {icon}
        {title}
        {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
      </h3>
      <div className="relative">
        {/* Scroll buttons */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-r from-[#0a0a0a] to-transparent hidden group-hover/row:flex items-center justify-center"
        >
          <ChevronLeft className="w-8 h-8 text-white" />
        </button>
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-l from-[#0a0a0a] to-transparent hidden group-hover/row:flex items-center justify-center"
        >
          <ChevronRight className="w-8 h-8 text-white" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto hide-scrollbar px-4 md:px-8 pb-4"
        >
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[180px] md:w-[200px]">
                  <div className="aspect-[2/3] rounded-lg skeleton" />
                  <div className="h-4 w-24 skeleton rounded mt-2" />
                </div>
              ))
            : (items || []).map((item, idx) => (
                <MediaCard key={item.id || idx} item={item} onClick={onItemClick} />
              ))
          }
        </div>
      </div>
    </div>
  );
}

/* =================================================================
   HERO SECTION
   ================================================================= */

function HeroSection({ item, onPlay, onDetail }) {
  const [imgError, setImgError] = useState(false);

  if (!item) {
    return (
      <div className="relative h-[70vh] min-h-[500px] bg-gradient-to-b from-gray-900 to-[#0a0a0a] flex items-end">
        <div className="gradient-overlay absolute inset-0" />
        <div className="relative z-10 px-4 md:px-16 pb-20 max-w-3xl">
          <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tight">
            <span className="text-red-600">DAGZ</span><span>FLIX</span>
          </h1>
          <p className="text-lg text-gray-300">Votre plateforme de streaming unifiee. Regardez et demandez vos contenus preferes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[70vh] min-h-[500px]">
      {/* Background image */}
      {!imgError && item.backdropUrl ? (
        <img
          src={item.backdropUrl}
          alt={item.name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-[#0a0a0a]" />
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/80 via-transparent to-transparent" />

      {/* Content */}
      <div className="relative z-10 h-full flex items-end">
        <div className="px-4 md:px-16 pb-20 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            {item.dagzRank && (
              <Badge className="bg-red-600 text-white mb-3 text-sm px-3 py-1">
                <Sparkles className="w-3 h-3 mr-1" /> Recommande a {item.dagzRank}%
              </Badge>
            )}
            <h1 className="text-4xl md:text-6xl font-black mb-3 leading-tight">{item.name}</h1>
            <div className="flex items-center gap-3 mb-4 text-sm text-gray-300">
              {item.year && <span>{item.year}</span>}
              {item.runtime > 0 && <span>{item.runtime} min</span>}
              {(item.communityRating || item.voteAverage) > 0 && (
                <span className="flex items-center gap-1 text-yellow-400">
                  <Star className="w-4 h-4" />
                  {(item.communityRating || item.voteAverage || 0).toFixed(1)}
                </span>
              )}
              {item.officialRating && (
                <Badge variant="outline" className="border-gray-500 text-gray-300">{item.officialRating}</Badge>
              )}
            </div>
            <p className="text-gray-300 text-base mb-6 line-clamp-3 max-w-xl">{item.overview}</p>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => onPlay(item)}
                className="bg-white hover:bg-gray-200 text-black font-bold px-8 h-12 text-base"
              >
                <Play className="w-5 h-5 mr-2 fill-current" /> Lecture
              </Button>
              <Button
                onClick={() => onDetail(item)}
                variant="outline"
                className="border-gray-500 text-white hover:bg-white/10 h-12 px-6"
              >
                <Info className="w-5 h-5 mr-2" /> Plus d'infos
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* =================================================================
   SMART BUTTON COMPONENT
   ================================================================= */

function SmartButton({ item, onPlay }) {
  const [status, setStatus] = useState('loading');
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    checkStatus();
  }, [item?.id]);

  const checkStatus = async () => {
    if (!item) return;
    setStatus('loading');
    try {
      const params = new URLSearchParams();
      if (item.id) params.set('id', item.id);
      if (item.tmdbId || item.providerIds?.Tmdb) params.set('tmdbId', item.tmdbId || item.providerIds?.Tmdb || '');
      params.set('mediaType', item.type === 'Series' ? 'tv' : 'movie');

      const res = await api(`media/status?${params.toString()}`);
      setStatus(res.status || 'unknown');
    } catch (err) {
      setStatus('unknown');
    }
  };

  const handleRequest = async () => {
    setRequesting(true);
    try {
      const tmdbId = item.tmdbId || item.providerIds?.Tmdb;
      const mediaType = item.type === 'Series' ? 'tv' : 'movie';
      const res = await api('media/request', {
        method: 'POST',
        body: JSON.stringify({ tmdbId, mediaType }),
      });
      if (res.success) {
        setRequested(true);
        setStatus('pending');
      }
    } catch (err) {
      console.error('Request error:', err);
    }
    setRequesting(false);
  };

  if (status === 'loading') {
    return (
      <Button className="bg-gray-700 text-gray-400 h-14 px-10 text-lg" disabled>
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Verification...
      </Button>
    );
  }

  if (status === 'available' || status === 'partial') {
    return (
      <Button
        onClick={() => onPlay(item)}
        className="bg-white hover:bg-gray-200 text-black font-bold h-14 px-10 text-lg"
      >
        <Play className="w-6 h-6 mr-2 fill-current" /> LECTURE
      </Button>
    );
  }

  if (status === 'pending') {
    return (
      <Button className="bg-yellow-600/20 text-yellow-400 border border-yellow-600 h-14 px-10 text-lg" disabled>
        <Clock className="w-5 h-5 mr-2" /> EN COURS D'ACQUISITION
      </Button>
    );
  }

  // Not available -> Request button
  return (
    <Button
      onClick={handleRequest}
      disabled={requesting || requested}
      className="bg-red-600 hover:bg-red-700 text-white font-bold h-14 px-10 text-lg"
    >
      {requesting ? (
        <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Envoi...</>
      ) : requested ? (
        <><Check className="w-5 h-5 mr-2" /> Demande envoyee</>
      ) : (
        <><Download className="w-5 h-5 mr-2" /> DEMANDER</>
      )}
    </Button>
  );
}

/* =================================================================
   MEDIA DETAIL VIEW
   ================================================================= */

function MediaDetailView({ item, onBack, onPlay, onItemClick }) {
  const [detail, setDetail] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    fetchDetail();
  }, [item]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      // If it's from Jellyfin (has jellyfinId or regular id)
      if (item.id && !item.tmdbId) {
        const res = await api(`media/detail?id=${item.id}`);
        if (res.item) {
          setDetail(res.item);
          setSimilar(res.similar || []);
        }
      } else {
        // From Jellyseerr search - use what we have
        setDetail(item);
      }
    } catch (err) {
      console.error('Detail fetch error:', err);
    }
    setLoading(false);
  };

  const displayItem = detail || item;

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen bg-[#0a0a0a]"
    >
      {/* Backdrop */}
      <div className="relative h-[60vh] min-h-[400px]">
        {!imgError && (displayItem.backdropUrl) ? (
          <img
            src={displayItem.backdropUrl}
            alt={displayItem.name}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-red-900/30 via-gray-900 to-[#0a0a0a]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent" />

        {/* Back button */}
        <div className="absolute top-20 left-4 md:left-8 z-20">
          <Button
            onClick={onBack}
            variant="outline"
            className="bg-black/50 border-gray-600 text-white hover:bg-black/80"
          >
            <ChevronLeft className="w-5 h-5 mr-1" /> Retour
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="relative -mt-48 z-10 px-4 md:px-16 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Poster */}
          <div className="flex-shrink-0 w-48 md:w-64">
            <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-2xl bg-gray-800">
              {displayItem.posterUrl ? (
                <img
                  src={displayItem.posterUrl}
                  alt={displayItem.name}
                  className="w-full h-full object-cover"
                  onError={e => e.target.style.display = 'none'}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Clapperboard className="w-16 h-16 text-gray-600" />
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-3xl md:text-5xl font-black mb-3">{displayItem.name}</h1>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              {displayItem.year && (
                <Badge variant="outline" className="border-gray-600 text-gray-300">{displayItem.year}</Badge>
              )}
              {displayItem.runtime > 0 && (
                <Badge variant="outline" className="border-gray-600 text-gray-300">
                  <Clock className="w-3 h-3 mr-1" /> {displayItem.runtime} min
                </Badge>
              )}
              {(displayItem.communityRating || displayItem.voteAverage) > 0 && (
                <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600">
                  <Star className="w-3 h-3 mr-1" />
                  {(displayItem.communityRating || displayItem.voteAverage || 0).toFixed(1)}
                </Badge>
              )}
              {displayItem.officialRating && (
                <Badge variant="outline" className="border-gray-600 text-gray-300">{displayItem.officialRating}</Badge>
              )}
              <Badge variant="outline" className="border-gray-600 text-gray-300">
                {displayItem.type === 'Series' ? <Tv className="w-3 h-3 mr-1" /> : <Film className="w-3 h-3 mr-1" />}
                {displayItem.type === 'Series' ? 'Serie' : 'Film'}
              </Badge>
            </div>

            {/* Genres */}
            {(displayItem.genres || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {displayItem.genres.map(g => (
                  <Badge key={g} className="bg-red-600/20 text-red-300 border-red-800">
                    {GENRE_EMOJIS[g] || ''} {g}
                  </Badge>
                ))}
              </div>
            )}

            {/* DagzRank */}
            {displayItem.dagzRank !== undefined && (
              <div className="mb-4 p-3 bg-red-600/10 border border-red-800/50 rounded-lg inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-red-400" />
                <span className="text-red-300 font-bold">DagzRank: {displayItem.dagzRank}%</span>
              </div>
            )}

            {/* Smart Button */}
            <div className="mb-6">
              <SmartButton item={displayItem} onPlay={onPlay} />
            </div>

            {/* Overview */}
            <p className="text-gray-300 leading-relaxed mb-6">{displayItem.overview}</p>

            {/* Cast */}
            {(displayItem.people || []).length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-2">Distribution</h3>
                <div className="flex flex-wrap gap-2">
                  {displayItem.people.filter(p => p.type === 'Actor').slice(0, 8).map((p, i) => (
                    <Badge key={i} variant="outline" className="border-gray-700 text-gray-300">
                      {p.name} {p.role ? `(${p.role})` : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Studios */}
            {(displayItem.studios || []).length > 0 && (
              <div className="text-sm text-gray-500">
                Studios: {displayItem.studios.join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Similar */}
        {similar.length > 0 && (
          <div className="mt-12">
            <MediaRow
              title="Similaire"
              items={similar}
              icon={<Film className="w-5 h-5 text-gray-400" />}
              onItemClick={onItemClick}
            />
          </div>
        )}
      </div>

      <div className="h-20" />
    </motion.div>
  );
}

/* =================================================================
   SEARCH VIEW
   ================================================================= */

function SearchView({ query, onItemClick, onBack }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(query);

  useEffect(() => {
    if (query) search(query);
  }, [query]);

  const search = async (q) => {
    setLoading(true);
    try {
      const res = await api(`search?q=${encodeURIComponent(q)}`);
      setResults(res.results || []);
    } catch (err) {
      console.error('Search error:', err);
    }
    setLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) search(searchInput.trim());
  };

  return (
    <div className="pt-20 px-4 md:px-16 min-h-screen">
      <form onSubmit={handleSubmit} className="mb-8 max-w-2xl">
        <div className="relative">
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Rechercher un film, une serie..."
            className="bg-gray-900 border-gray-700 text-white h-14 pl-14 text-lg"
            autoFocus
          />
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
      </form>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[2/3] rounded-lg skeleton" />
              <div className="h-4 w-20 skeleton rounded mt-2" />
            </div>
          ))}
        </div>
      ) : results.length > 0 ? (
        <>
          <p className="text-gray-400 mb-6">{results.length} resultat(s) pour "{query}"</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {results.map((item, idx) => (
              <MediaCard key={item.id || idx} item={item} onClick={onItemClick} />
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-20">
          <Search className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h3 className="text-xl text-gray-400">Aucun resultat pour "{query}"</h3>
          <p className="text-gray-600 mt-2">Essayez avec d'autres termes de recherche</p>
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
  const [loadingStates, setLoadingStates] = useState({
    reco: true, movies: true, series: true, trendM: true, trendS: true,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, [mediaType]);

  const loadDashboard = async () => {
    const setLoad = (key, val) => setLoadingStates(prev => ({ ...prev, [key]: val }));

    // Load recommendations
    setLoad('reco', true);
    api('recommendations').then(res => {
      const recs = res.recommendations || [];
      setRecommendations(recs);
      if (recs.length > 0) setHeroItem(recs[0]);
      setLoad('reco', false);
    }).catch(err => {
      setLoad('reco', false);
      setError('Impossible de charger les recommandations');
    });

    // Load latest movies
    if (!mediaType || mediaType === 'movies') {
      setLoad('movies', true);
      api('media/library?type=Movie&limit=20&sortBy=DateCreated&sortOrder=Descending').then(res => {
        setLatestMovies(res.items || []);
        if (!heroItem && (res.items || []).length > 0) setHeroItem(res.items[0]);
        setLoad('movies', false);
      }).catch(() => setLoad('movies', false));
    }

    // Load latest series
    if (!mediaType || mediaType === 'series') {
      setLoad('series', true);
      api('media/library?type=Series&limit=20&sortBy=DateCreated&sortOrder=Descending').then(res => {
        setLatestSeries(res.items || []);
        setLoad('series', false);
      }).catch(() => setLoad('series', false));
    }

    // Load trending from Jellyseerr
    setLoad('trendM', true);
    api('discover?type=movies').then(res => {
      setTrendingMovies(res.results || []);
      setLoad('trendM', false);
    }).catch(() => setLoad('trendM', false));

    setLoad('trendS', true);
    api('discover?type=tv').then(res => {
      setTrendingSeries(res.results || []);
      setLoad('trendS', false);
    }).catch(() => setLoad('trendS', false));
  };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <HeroSection item={heroItem} onPlay={onPlay} onDetail={onItemClick} />

      {/* Error banner */}
      {error && (
        <div className="mx-4 md:mx-8 mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-300 text-sm">{error}</span>
          <button onClick={loadDashboard} className="ml-auto text-red-400 hover:text-red-300">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Content Rows */}
      <div className="-mt-10 relative z-10">
        <MediaRow
          title="Recommande pour vous"
          items={recommendations}
          icon={<Sparkles className="w-5 h-5 text-red-500" />}
          onItemClick={onItemClick}
          loading={loadingStates.reco}
        />

        {(!mediaType || mediaType === 'movies') && (
          <MediaRow
            title="Films recemment ajoutes"
            items={latestMovies}
            icon={<Film className="w-5 h-5 text-blue-400" />}
            onItemClick={onItemClick}
            loading={loadingStates.movies}
          />
        )}

        {(!mediaType || mediaType === 'series') && (
          <MediaRow
            title="Series recemment ajoutees"
            items={latestSeries}
            icon={<Tv className="w-5 h-5 text-green-400" />}
            onItemClick={onItemClick}
            loading={loadingStates.series}
          />
        )}

        <MediaRow
          title="Tendances - Films"
          items={trendingMovies}
          icon={<TrendingUp className="w-5 h-5 text-orange-400" />}
          onItemClick={onItemClick}
          loading={loadingStates.trendM}
        />

        <MediaRow
          title="Tendances - Series"
          items={trendingSeries}
          icon={<TrendingUp className="w-5 h-5 text-purple-400" />}
          onItemClick={onItemClick}
          loading={loadingStates.trendS}
        />
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

  useEffect(() => {
    checkInitialState();
  }, []);

  const checkInitialState = async () => {
    try {
      // Check if setup is complete
      const setupRes = await api('setup/check');
      if (!setupRes.setupComplete) {
        setView('setup');
        return;
      }

      // Check if user has active session
      const sessionRes = await api('auth/session');
      if (sessionRes.authenticated) {
        setUser(sessionRes.user);
        if (!sessionRes.onboardingComplete) {
          setView('onboarding');
        } else {
          setView('dashboard');
        }
      } else {
        setView('login');
      }
    } catch (err) {
      console.error('Init error:', err);
      setView('setup');
    }
  };

  const handleLogin = (userData, onboardingDone) => {
    setUser(userData);
    if (!onboardingDone) {
      setView('onboarding');
    } else {
      setView('dashboard');
    }
  };

  const handleItemClick = (item) => {
    setSelectedItem(item);
    setView('detail');
    window.scrollTo(0, 0);
  };

  const handlePlay = (item) => {
    // For now, navigate to detail with play intent
    setSelectedItem(item);
    setView('detail');
    window.scrollTo(0, 0);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    setView('search');
  };

  const handleNavigate = (target) => {
    if (target === 'dashboard') {
      setMediaTypeFilter(null);
      setView('dashboard');
    } else if (target === 'movies') {
      setMediaTypeFilter('movies');
      setView('dashboard');
    } else if (target === 'series') {
      setMediaTypeFilter('series');
      setView('dashboard');
    }
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <AnimatePresence mode="wait">
        {view === 'loading' && <LoadingScreen key="loading" />}

        {view === 'setup' && (
          <SetupView key="setup" onComplete={() => setView('login')} />
        )}

        {view === 'login' && (
          <LoginView key="login" onLogin={handleLogin} />
        )}

        {view === 'onboarding' && (
          <OnboardingView key="onboarding" onComplete={() => setView('dashboard')} />
        )}

        {(view === 'dashboard' || view === 'search' || view === 'detail') && (
          <div key="main">
            <Navbar
              user={user}
              onSearch={handleSearch}
              onNavigate={handleNavigate}
              currentView={view === 'dashboard' ? (mediaTypeFilter || 'dashboard') : view}
            />

            {view === 'dashboard' && (
              <DashboardView
                user={user}
                onItemClick={handleItemClick}
                onPlay={handlePlay}
                mediaType={mediaTypeFilter}
              />
            )}

            {view === 'search' && (
              <SearchView
                query={searchQuery}
                onItemClick={handleItemClick}
                onBack={() => setView('dashboard')}
              />
            )}

            {view === 'detail' && selectedItem && (
              <MediaDetailView
                item={selectedItem}
                onBack={() => { setView('dashboard'); window.scrollTo(0, 0); }}
                onPlay={handlePlay}
                onItemClick={handleItemClick}
              />
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
