'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  SkipBack, SkipForward, Subtitles, AudioLines, Wand2,
  Library, Smile, Brain, Laugh, Ghost, Frown, CalendarDays, Timer,
} from 'lucide-react';

/* =================================================================
   CACHE SYSTEM
   ================================================================= */
const apiCache = new Map();
const CACHE_TTLS = { 'setup/check': 120000, 'auth/session': 60000, 'media/library': 300000, 'media/detail': 600000,
  'media/seasons': 600000, 'media/episodes': 600000, 'media/trailer': 3600000, 'media/collection': 3600000,
  'media/status': 60000, 'search': 120000, 'discover': 300000, 'recommendations': 300000, 'wizard': 120000 };
function getCacheTTL(p) { for (const [k, v] of Object.entries(CACHE_TTLS)) { if (p.startsWith(k)) return v; } return 60000; }
async function api(p, o = {}) { const r = await fetch(`/api/${p}`, { headers: { 'Content-Type': 'application/json', ...o.headers }, ...o }); return r.json(); }
async function cachedApi(p, o = {}) {
  const isGet = !o.method || o.method === 'GET';
  if (isGet) { const c = apiCache.get(p); if (c && Date.now() - c.ts < getCacheTTL(p)) return c.data; }
  const d = await api(p, o); if (isGet) apiCache.set(p, { data: d, ts: Date.now() }); return d;
}
function invalidateCache(pfx) { for (const k of apiCache.keys()) { if (k.startsWith(pfx)) apiCache.delete(k); } }

/* =================================================================
   CONSTANTS
   ================================================================= */
const GENRE_LIST = ['Action','Adventure','Animation','Comedy','Crime','Documentary','Drama','Family','Fantasy','History','Horror','Music','Mystery','Romance','Science Fiction','Thriller','War','Western'];
const GENRE_EMOJIS = { Action:'\ud83d\udca5', Adventure:'\ud83d\uddfa\ufe0f', Animation:'\ud83c\udfa8', Comedy:'\ud83d\ude02', Crime:'\ud83d\udd0d', Documentary:'\ud83d\udcf9', Drama:'\ud83c\udfad', Family:'\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66', Fantasy:'\ud83e\uddd9', History:'\ud83d\udcdc', Horror:'\ud83d\udc7b', Music:'\ud83c\udfb5', Mystery:'\ud83d\udd75\ufe0f', Romance:'\ud83d\udc95', 'Science Fiction':'\ud83d\ude80', Thriller:'\ud83d\ude30', War:'\u2694\ufe0f', Western:'\ud83e\udd20' };
const transition = { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] };
const pageVariants = { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0, transition }, exit: { opacity: 0, y: -20, transition: { duration: 0.3 } } };
function formatTime(s) { if (!s || isNaN(s)) return '0:00'; const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60); return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`; }

/* =================================================================
   LOADING
   ================================================================= */
function LoadingScreen() {
  return (<div className="flex items-center justify-center min-h-screen bg-[#050505]">
    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
      <h1 className="text-6xl font-black tracking-tighter mb-6"><span className="text-red-600">DAGZ</span><span>FLIX</span></h1>
      <div className="flex items-center justify-center gap-1.5">{[0,1,2].map(i=>(
        <motion.div key={i} className="w-2.5 h-2.5 bg-red-600 rounded-full" animate={{ scale:[1,1.4,1], opacity:[0.5,1,0.5] }} transition={{ duration:1, repeat:Infinity, delay:i*0.2 }} />))}</div>
    </motion.div></div>);
}

/* =================================================================
   SETUP VIEW
   ================================================================= */
function SetupView({ onComplete }) {
  const [step,setStep]=useState(1); const [jUrl,setJUrl]=useState(''); const [jKey,setJKey]=useState(''); const [sUrl,setSUrl]=useState(''); const [sKey,setSKey]=useState('');
  const [testing,setTesting]=useState(false); const [testResult,setTestResult]=useState(null); const [saving,setSaving]=useState(false); const [error,setError]=useState('');
  const testConn = async(t)=>{ setTesting(true); setTestResult(null); setError('');
    try { const r=await api('setup/test',{method:'POST',body:JSON.stringify({type:t,url:t==='jellyfin'?jUrl:sUrl,apiKey:t==='jellyfin'?jKey:sKey})}); if(r.success) setTestResult({type:t,...r}); else setError(r.error||'Echec'); } catch(e){ setError(e.message); } setTesting(false); };
  const save = async()=>{ setSaving(true); setError('');
    try { const r=await api('setup/save',{method:'POST',body:JSON.stringify({jellyfinUrl:jUrl,jellyfinApiKey:jKey,jellyseerrUrl:sUrl,jellyseerrApiKey:sKey})}); if(r.success){invalidateCache('setup'); onComplete();} else setError(r.error); } catch(e){ setError(e.message); } setSaving(false); };

  return (<motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
    <div className="w-full max-w-lg">
      <div className="text-center mb-10"><h1 className="text-7xl font-black tracking-tighter mb-3"><span className="text-red-600">DAGZ</span><span>FLIX</span></h1><p className="text-gray-500 text-lg font-light">Configuration initiale</p></div>
      <div className="flex items-center justify-center gap-3 mb-10">{[1,2,3].map(s=>(<div key={s} className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold transition-all ${s===step?'bg-red-600 text-white shadow-lg shadow-red-600/30 scale-110':s<step?'bg-white/10 text-green-400':'bg-white/5 text-gray-600'}`}>{s<step?<Check className="w-5 h-5"/>:s}</div>
        {s<3&&<div className={`w-14 h-[2px] rounded-full ${s<step?'bg-green-500/50':'bg-white/5'}`}/>}</div>))}</div>
      <AnimatePresence mode="wait">
        {step===1&&(<motion.div key="s1" initial={{opacity:0,x:40}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-40}} className="glass-strong rounded-3xl p-8">
          <div className="flex items-center gap-4 mb-8"><div className="p-3.5 bg-purple-500/15 rounded-2xl"><Server className="w-6 h-6 text-purple-400"/></div><div><h2 className="text-xl font-bold">Jellyfin</h2><p className="text-sm text-gray-500">Serveur de streaming</p></div></div>
          <div className="space-y-5">
            <div><Label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">URL *</Label><Input value={jUrl} onChange={e=>setJUrl(e.target.value)} placeholder="https://jellyfin.example.com" className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-12 rounded-xl"/></div>
            <div><Label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Cle API</Label><Input value={jKey} onChange={e=>setJKey(e.target.value)} placeholder="Cle API" className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-12 rounded-xl" type="password"/></div>
            {testResult?.type==='jellyfin'&&<div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-400 text-sm flex items-center gap-2"><Check className="w-4 h-4"/>{testResult.serverName}</div>}
            {error&&<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">{error}</div>}
            <div className="flex gap-3"><Button variant="outline" className="flex-1 border-white/10 text-gray-300 h-12 rounded-xl" onClick={()=>testConn('jellyfin')} disabled={!jUrl||testing}>{testing?<Loader2 className="w-4 h-4 animate-spin mr-2"/>:<Link2 className="w-4 h-4 mr-2"/>}Tester</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 h-12 rounded-xl font-semibold" onClick={()=>{setStep(2);setError('');setTestResult(null);}} disabled={!jUrl}>Suivant<ArrowRight className="w-4 h-4 ml-2"/></Button></div>
          </div></motion.div>)}
        {step===2&&(<motion.div key="s2" initial={{opacity:0,x:40}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-40}} className="glass-strong rounded-3xl p-8">
          <div className="flex items-center gap-4 mb-8"><div className="p-3.5 bg-blue-500/15 rounded-2xl"><Download className="w-6 h-6 text-blue-400"/></div><div><h2 className="text-xl font-bold">Jellyseerr</h2><p className="text-sm text-gray-500">Requetes (optionnel)</p></div></div>
          <div className="space-y-5">
            <div><Label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">URL</Label><Input value={sUrl} onChange={e=>setSUrl(e.target.value)} placeholder="https://jellyseerr.example.com" className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-12 rounded-xl"/></div>
            <div><Label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Cle API</Label><Input value={sKey} onChange={e=>setSKey(e.target.value)} placeholder="Cle API" className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-12 rounded-xl" type="password"/></div>
            {error&&<div className="p-4 bg-red-500/10 rounded-2xl text-red-400 text-sm">{error}</div>}
            <div className="flex gap-3"><Button variant="outline" className="border-white/10 text-gray-300 h-12 rounded-xl" onClick={()=>{setStep(1);setError('');}}><ChevronLeft className="w-4 h-4 mr-1"/>Retour</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 h-12 rounded-xl font-semibold" onClick={()=>{setStep(3);setError('');}}>Suivant<ArrowRight className="w-4 h-4 ml-2"/></Button></div>
          </div></motion.div>)}
        {step===3&&(<motion.div key="s3" initial={{opacity:0,x:40}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-40}} className="glass-strong rounded-3xl p-8">
          <div className="flex items-center gap-4 mb-8"><div className="p-3.5 bg-green-500/15 rounded-2xl"><Shield className="w-6 h-6 text-green-400"/></div><div><h2 className="text-xl font-bold">Confirmation</h2></div></div>
          <div className="space-y-4">
            <div className="p-5 bg-white/3 rounded-2xl border border-white/5"><p className="text-purple-400 text-sm font-semibold mb-1">Jellyfin</p><p className="text-sm text-gray-300 break-all">{jUrl}</p></div>
            <div className="p-5 bg-white/3 rounded-2xl border border-white/5"><p className="text-blue-400 text-sm font-semibold mb-1">Jellyseerr</p><p className="text-sm text-gray-300 break-all">{sUrl||'Non configure'}</p></div>
            {error&&<div className="p-4 bg-red-500/10 rounded-2xl text-red-400 text-sm">{error}</div>}
            <div className="flex gap-3"><Button variant="outline" className="border-white/10 text-gray-300 h-12 rounded-xl" onClick={()=>setStep(2)}><ChevronLeft className="w-4 h-4 mr-1"/>Retour</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 h-12 rounded-xl font-bold pulse-glow" onClick={save} disabled={saving}>{saving?<Loader2 className="w-4 h-4 animate-spin mr-2"/>:<Check className="w-4 h-4 mr-2"/>}Sauvegarder</Button></div>
          </div></motion.div>)}
      </AnimatePresence>
    </div></motion.div>);
}

/* =================================================================
   LOGIN
   ================================================================= */
function LoginView({ onLogin }) {
  const [u,setU]=useState(''); const [p,setP]=useState(''); const [show,setShow]=useState(false); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  const submit = async(e)=>{ e.preventDefault(); setLoading(true); setError('');
    try { const r=await api('auth/login',{method:'POST',body:JSON.stringify({username:u,password:p})}); if(r.success){invalidateCache('auth');onLogin(r.user,r.onboardingComplete);} else setError(r.error||'Echec'); } catch(e){ setError(e.message); } setLoading(false); };
  return (<motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-900/20 rounded-full blur-[150px]"/>
    <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-900/10 rounded-full blur-[120px]"/>
    <div className="relative w-full max-w-md z-10">
      <div className="text-center mb-12"><h1 className="text-7xl font-black tracking-tighter mb-3"><span className="text-red-600">DAGZ</span><span>FLIX</span></h1><p className="text-gray-500 font-light">Identifiants Jellyfin</p></div>
      <motion.form initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.2}} onSubmit={submit} className="glass-strong rounded-3xl p-10 space-y-6">
        <div><Label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Utilisateur</Label>
          <Input value={u} onChange={e=>setU(e.target.value)} placeholder="Nom d'utilisateur" className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-13 rounded-xl text-base" autoFocus/></div>
        <div><Label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Mot de passe</Label>
          <div className="relative"><Input value={p} onChange={e=>setP(e.target.value)} type={show?'text':'password'} placeholder="Mot de passe" className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-13 rounded-xl text-base pr-12"/>
            <button type="button" onClick={()=>setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300">{show?<EyeOff className="w-5 h-5"/>:<Eye className="w-5 h-5"/>}</button></div></div>
        {error&&<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4"/>{error}</div>}
        <Button type="submit" className="w-full h-13 bg-red-600 hover:bg-red-700 font-bold text-lg rounded-xl" disabled={loading||!u||!p}>{loading?<Loader2 className="w-5 h-5 animate-spin"/>:'Se connecter'}</Button>
      </motion.form></div></motion.div>);
}

/* =================================================================
   ONBOARDING
   ================================================================= */
function OnboardingView({ onComplete }) {
  const [fav,setFav]=useState([]); const [dis,setDis]=useState([]); const [saving,setSaving]=useState(false);
  const toggle=(g,l,sl,o,so)=>{ if(o.includes(g)) so(o.filter(x=>x!==g)); sl(l.includes(g)?l.filter(x=>x!==g):[...l,g]); };
  const save=async()=>{ setSaving(true); await api('preferences',{method:'POST',body:JSON.stringify({favoriteGenres:fav,dislikedGenres:dis})}); invalidateCache('preferences'); invalidateCache('recommendations'); setSaving(false); onComplete(); };
  return (<motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
    <div className="w-full max-w-2xl">
      <div className="text-center mb-10"><div className="w-16 h-16 bg-red-600/15 rounded-3xl flex items-center justify-center mx-auto mb-5"><Sparkles className="w-8 h-8 text-red-500"/></div>
        <h2 className="text-3xl font-bold mb-2">Bienvenue !</h2><p className="text-gray-500">Personnalisez vos recommandations</p></div>
      <div className="glass-strong rounded-3xl p-8 mb-6"><h3 className="text-base font-semibold mb-4 flex items-center gap-2"><Heart className="w-5 h-5 text-red-500"/>Genres adorez</h3>
        <div className="flex flex-wrap gap-2">{GENRE_LIST.map(g=>(<button key={g} onClick={()=>toggle(g,fav,setFav,dis,setDis)} className={`px-4 py-2.5 rounded-2xl text-sm font-medium transition-all ${fav.includes(g)?'bg-red-600 text-white shadow-lg shadow-red-600/20 scale-105':'bg-white/5 text-gray-400 hover:bg-white/10'}`}>{GENRE_EMOJIS[g]} {g}</button>))}</div></div>
      <div className="glass-strong rounded-3xl p-8 mb-8"><h3 className="text-base font-semibold mb-4 flex items-center gap-2"><ThumbsDown className="w-5 h-5 text-gray-500"/>Genres a eviter</h3>
        <div className="flex flex-wrap gap-2">{GENRE_LIST.map(g=>(<button key={g} onClick={()=>toggle(g,dis,setDis,fav,setFav)} className={`px-4 py-2.5 rounded-2xl text-sm font-medium transition-all ${dis.includes(g)?'bg-gray-600 text-white line-through':'bg-white/5 text-gray-400 hover:bg-white/10'}`}>{GENRE_EMOJIS[g]} {g}</button>))}</div></div>
      <Button onClick={save} disabled={saving} className="w-full h-14 bg-red-600 hover:bg-red-700 font-bold text-lg rounded-2xl">{saving?<Loader2 className="w-5 h-5 animate-spin mr-2"/>:<Sparkles className="w-5 h-5 mr-2"/>}Commencer</Button>
      <button onClick={onComplete} className="w-full mt-4 text-gray-600 hover:text-gray-400 text-sm">Passer</button>
    </div></motion.div>);
}

/* =================================================================
   NAVBAR
   ================================================================= */
function Navbar({ user, onSearch, onNavigate, currentView }) {
  const [searchOpen,setSearchOpen]=useState(false); const [sq,setSq]=useState(''); const [scrolled,setScrolled]=useState(false);
  useEffect(()=>{ const h=()=>setScrolled(window.scrollY>50); window.addEventListener('scroll',h); return()=>window.removeEventListener('scroll',h); },[]);
  const submit=(e)=>{e.preventDefault(); if(sq.trim()){onSearch(sq.trim());setSearchOpen(false);}};
  const logout=async()=>{await api('auth/logout',{method:'POST'}); apiCache.clear(); window.location.reload();};
  return (<nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled?'bg-black/80 backdrop-blur-2xl shadow-2xl':'bg-gradient-to-b from-black/60 to-transparent'}`}>
    <div className="max-w-[1800px] mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
      <div className="flex items-center gap-10">
        <button onClick={()=>onNavigate('dashboard')}><h1 className="text-2xl font-black tracking-tighter"><span className="text-red-600">DAGZ</span><span>FLIX</span></h1></button>
        <div className="hidden md:flex items-center gap-1">
          {[{id:'dashboard',label:'Accueil',icon:Home},{id:'movies',label:'Films',icon:Film},{id:'series',label:'Series',icon:Tv}].map(t=>(
            <button key={t.id} onClick={()=>onNavigate(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${currentView===t.id?'bg-white/10 text-white':'text-gray-400 hover:text-white hover:bg-white/5'}`}><t.icon className="w-4 h-4"/>{t.label}</button>))}</div></div>
      <div className="flex items-center gap-3">
        <AnimatePresence>{searchOpen?(
          <motion.form key="s" initial={{width:0,opacity:0}} animate={{width:320,opacity:1}} exit={{width:0,opacity:0}} onSubmit={submit} className="relative">
            <Input value={sq} onChange={e=>setSq(e.target.value)} placeholder="Rechercher..." className="bg-white/5 border-white/10 text-white h-10 pl-10 pr-10 rounded-xl" autoFocus/>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"/>
            <button type="button" onClick={()=>{setSearchOpen(false);setSq('');}} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X className="w-4 h-4"/></button>
          </motion.form>):(<button onClick={()=>setSearchOpen(true)} className="p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5"><Search className="w-5 h-5"/></button>)}</AnimatePresence>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-red-600/20">{user?.name?.[0]?.toUpperCase()||'U'}</div>
        <button onClick={logout} className="p-2 rounded-xl text-gray-500 hover:text-red-500 hover:bg-white/5" title="Deconnexion"><LogOut className="w-4 h-4"/></button></div></div></nav>);
}

/* =================================================================
   MEDIA CARD
   ================================================================= */
function MediaCard({ item, onClick, size='normal' }) {
  const [imgErr,setImgErr]=useState(false);
  const w=size==='large'?'w-[220px] md:w-[260px]':'w-[160px] md:w-[185px]';
  return (<motion.div className={`flex-shrink-0 ${w} cursor-pointer`} onClick={()=>onClick(item)} whileHover={{scale:1.06,y:-8}} transition={{duration:0.35,ease:[0.25,0.46,0.45,0.94]}}>
    <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-white/3 relative card-reflection group shadow-lg shadow-black/30">
      {!imgErr&&item.posterUrl?<img src={item.posterUrl} alt={item.name} className="w-full h-full object-cover" onError={()=>setImgErr(true)} loading="lazy"/>:
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-950"><Clapperboard className="w-10 h-10 text-gray-700"/></div>}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-end p-4">
        <p className="text-white font-semibold text-sm line-clamp-2">{item.name}</p>
        <div className="flex items-center gap-2 mt-1.5">{item.year&&<span className="text-gray-400 text-xs">{item.year}</span>}
          {(item.communityRating||item.voteAverage)>0&&<span className="flex items-center gap-1 text-yellow-400 text-xs"><Star className="w-3 h-3 fill-current"/>{(item.communityRating||item.voteAverage).toFixed(1)}</span>}</div>
        {item.dagzRank>0&&<div className="mt-1.5 flex items-center gap-1"><div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full" style={{width:`${item.dagzRank}%`}}/></div><span className="text-red-400 text-[10px] font-bold">{item.dagzRank}%</span></div>}</div>
      {item.mediaStatus===5&&<div className="absolute top-2.5 right-2.5"><div className="bg-green-500/90 backdrop-blur text-white text-[10px] px-2 py-0.5 rounded-lg font-medium">Disponible</div></div>}
    </div><p className="text-gray-400 text-sm mt-2.5 truncate font-medium">{item.name}</p></motion.div>);
}

/* =================================================================
   MEDIA ROW
   ================================================================= */
function MediaRow({ title, items, icon, onItemClick, loading, size }) {
  const ref=useRef(null); const scroll=(d)=>ref.current?.scrollBy({left:d==='left'?-600:600,behavior:'smooth'});
  if (!loading&&(!items||items.length===0)) return null;
  return (<div className="mb-12 group/row">
    <h3 className="text-lg font-bold text-white mb-5 px-6 md:px-10 flex items-center gap-2.5">{icon}{title}{loading&&<Loader2 className="w-4 h-4 animate-spin text-gray-600"/>}</h3>
    <div className="relative">
      <button onClick={()=>scroll('left')} className="absolute left-0 top-0 bottom-8 z-10 w-14 bg-gradient-to-r from-[#050505] to-transparent hidden group-hover/row:flex items-center justify-center"><div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"><ChevronLeft className="w-5 h-5"/></div></button>
      <button onClick={()=>scroll('right')} className="absolute right-0 top-0 bottom-8 z-10 w-14 bg-gradient-to-l from-[#050505] to-transparent hidden group-hover/row:flex items-center justify-center"><div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"><ChevronRight className="w-5 h-5"/></div></button>
      <div ref={ref} className="flex gap-4 overflow-x-auto hide-scrollbar px-6 md:px-10 pb-4">
        {loading?Array.from({length:8}).map((_,i)=>(<div key={i} className={`flex-shrink-0 ${size==='large'?'w-[220px] md:w-[260px]':'w-[160px] md:w-[185px]'}`}><div className="aspect-[2/3] skeleton"/></div>)):
          (items||[]).map((item,idx)=><MediaCard key={item.id||idx} item={item} onClick={onItemClick} size={size}/>)}</div></div></div>);
}

/* =================================================================
   HERO SECTION
   ================================================================= */
function HeroSection({ item, onPlay, onDetail }) {
  const [imgErr,setImgErr]=useState(false);
  return (<div className="relative h-[75vh] min-h-[550px]">
    {!imgErr&&item?.backdropUrl?<img src={item.backdropUrl} alt={item.name} className="absolute inset-0 w-full h-full object-cover" onError={()=>setImgErr(true)}/>:
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-[#050505]"/>}
    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/30 to-[#050505]/10"/>
    <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/90 via-[#050505]/30 to-transparent"/>
    <div className="relative z-10 h-full flex items-end"><div className="px-6 md:px-16 pb-24 max-w-3xl">
      <motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{duration:0.8}}>
        {item?.dagzRank>0&&<div className="inline-flex items-center gap-1.5 bg-red-600/20 backdrop-blur-sm border border-red-500/20 text-red-300 rounded-full px-3 py-1 text-sm font-medium mb-4"><Sparkles className="w-3.5 h-3.5"/>Recommande a {item.dagzRank}%</div>}
        <h1 className="text-4xl md:text-6xl font-black mb-4 leading-[1.1]">{item?.name||'DAGZFLIX'}</h1>
        {item?.overview&&<p className="text-gray-300 text-base mb-8 line-clamp-3 max-w-xl font-light leading-relaxed">{item.overview}</p>}
        {item&&<div className="flex items-center gap-3">
          <Button onClick={()=>onPlay(item)} className="bg-white hover:bg-gray-100 text-black font-bold px-8 h-13 text-base rounded-xl shadow-xl shadow-white/10"><Play className="w-5 h-5 mr-2 fill-current"/>Lecture</Button>
          <Button onClick={()=>onDetail(item)} variant="outline" className="border-white/20 text-white hover:bg-white/10 h-13 px-6 rounded-xl backdrop-blur"><Info className="w-5 h-5 mr-2"/>Plus d'infos</Button></div>}
      </motion.div></div></div></div>);
}

/* =================================================================
   SMART BUTTON
   ================================================================= */
function SmartButton({ item, onPlay }) {
  const [status,setStatus]=useState('loading'); const [requesting,setRequesting]=useState(false); const [requested,setRequested]=useState(false);
  useEffect(()=>{if(item)check();},[item?.id]);
  const check=async()=>{ setStatus('loading'); try { const p=new URLSearchParams(); if(item.id) p.set('id',item.id); if(item.tmdbId||item.providerIds?.Tmdb) p.set('tmdbId',item.tmdbId||item.providerIds?.Tmdb); p.set('mediaType',item.type==='Series'?'tv':'movie'); const r=await cachedApi(`media/status?${p.toString()}`); setStatus(r.status||'unknown'); } catch{setStatus('unknown');} };
  const req=async()=>{ setRequesting(true); try { const r=await api('media/request',{method:'POST',body:JSON.stringify({tmdbId:item.tmdbId||item.providerIds?.Tmdb,mediaType:item.type==='Series'?'tv':'movie'})}); if(r.success){setRequested(true);setStatus('pending');} } catch(e){} setRequesting(false); };
  const cls="h-13 px-8 text-base font-bold rounded-xl transition-all";
  if(status==='loading') return <Button className={`${cls} bg-white/5 text-gray-500`} disabled><Loader2 className="w-5 h-5 animate-spin mr-2"/>Verification...</Button>;
  if(status==='available'||status==='partial') return <Button onClick={()=>onPlay(item)} className={`${cls} bg-white hover:bg-gray-100 text-black shadow-xl shadow-white/10`}><Play className="w-5 h-5 mr-2 fill-current"/>LECTURE</Button>;
  if(status==='pending') return <Button className={`${cls} bg-yellow-500/10 text-yellow-400 border border-yellow-500/30`} disabled><Clock className="w-5 h-5 mr-2"/>EN COURS</Button>;
  return <Button onClick={req} disabled={requesting||requested} className={`${cls} bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/20`}>
    {requesting?<><Loader2 className="w-5 h-5 animate-spin mr-2"/>Envoi...</>:requested?<><Check className="w-5 h-5 mr-2"/>Envoyee</>:<><Download className="w-5 h-5 mr-2"/>DEMANDER</>}</Button>;
}

/* =================================================================
   TRAILER BUTTON
   ================================================================= */
function TrailerButton({ item }) {
  const [trailers,setTrailers]=useState([]); const [show,setShow]=useState(false); const [loading,setLoading]=useState(false);
  const fetch_=async()=>{ setLoading(true); try { const p=new URLSearchParams(); if(item.id) p.set('id',item.id); if(item.tmdbId||item.providerIds?.Tmdb) p.set('tmdbId',item.tmdbId||item.providerIds?.Tmdb); p.set('mediaType',item.type==='Series'?'tv':'movie'); const r=await cachedApi(`media/trailer?${p.toString()}`); setTrailers(r.trailers||[]); if((r.trailers||[]).length>0) setShow(true); } catch(e){} setLoading(false); };
  const ytId=(u)=>{const m=(u||'').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/); return m?m[1]:null;};
  return (<><Button onClick={fetch_} disabled={loading} variant="outline" className="h-13 px-6 rounded-xl border-white/15 text-white hover:bg-white/5">
    {loading?<Loader2 className="w-5 h-5 animate-spin mr-2"/>:<Youtube className="w-5 h-5 mr-2 text-red-500"/>}Bande-annonce</Button>
    <AnimatePresence>{show&&trailers.length>0&&(
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl" onClick={()=>setShow(false)}>
        <motion.div initial={{scale:0.9}} animate={{scale:1}} exit={{scale:0.9}} className="w-full max-w-4xl glass-strong rounded-3xl overflow-hidden" onClick={e=>e.stopPropagation()}>
          <div className="flex items-center justify-between p-5"><h3 className="text-lg font-bold">Bande-annonce</h3>
            <button onClick={()=>setShow(false)} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10"><X className="w-5 h-5"/></button></div>
          <div className="aspect-video bg-black">{(()=>{const id=ytId(trailers[0]?.url)||trailers[0]?.key; return id?<iframe src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`} className="w-full h-full" allowFullScreen allow="autoplay; encrypted-media"/>:<div className="w-full h-full flex items-center justify-center"><a href={trailers[0]?.url} target="_blank" rel="noopener noreferrer" className="text-red-400"><Youtube className="w-8 h-8"/></a></div>;})()}</div>
        </motion.div></motion.div>)}</AnimatePresence></>);
}

/* =================================================================
   VIDEO PLAYER - Direct Play (no proxy, no timeout)
   ================================================================= */
function VideoPlayer({ item, episodeId, onClose }) {
  const [streamUrl,setStreamUrl]=useState(''); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const [isPlaying,setIsPlaying]=useState(false); const [currentTime,setCurrentTime]=useState(0); const [duration,setDuration]=useState(0);
  const [volume,setVolume]=useState(1); const [isMuted,setIsMuted]=useState(false); const [showControls,setShowControls]=useState(true);
  const [subtitles,setSubtitles]=useState([]); const [audioTracks,setAudioTracks]=useState([]);
  const [activeSub,setActiveSub]=useState(-1); const [showSubMenu,setShowSubMenu]=useState(false); const [showAudioMenu,setShowAudioMenu]=useState(false);
  const [buffered,setBuffered]=useState(0);
  const videoRef=useRef(null); const ctrlTimer=useRef(null); const progressRef=useRef(null);

  useEffect(()=>{ fetchStream(); return()=>{if(ctrlTimer.current) clearTimeout(ctrlTimer.current);}; },[]);

  const fetchStream=async()=>{
    try { const id=episodeId||item?.id; if(!id){setError('ID manquant');setLoading(false);return;}
      const r=await api(`media/stream?id=${id}`);
      if(r.streamUrl){ setStreamUrl(r.streamUrl); setSubtitles(r.subtitles||[]); setAudioTracks(r.audioTracks||[]); if(r.duration) setDuration(r.duration); }
      else setError(r.error||'Stream indisponible');
    } catch(e){setError(e.message);} setLoading(false);
  };

  const resetTimer=useCallback(()=>{
    setShowControls(true); if(ctrlTimer.current) clearTimeout(ctrlTimer.current);
    ctrlTimer.current=setTimeout(()=>{if(isPlaying) setShowControls(false);},4000);
  },[isPlaying]);

  const togglePlay=()=>{ if(!videoRef.current) return; if(videoRef.current.paused){videoRef.current.play();setIsPlaying(true);}else{videoRef.current.pause();setIsPlaying(false);} resetTimer(); };
  const skip=(s)=>{ if(!videoRef.current) return; videoRef.current.currentTime=Math.max(0,Math.min(videoRef.current.duration||0,videoRef.current.currentTime+s)); resetTimer(); };
  const handleVol=(v)=>{ if(!videoRef.current) return; const val=parseFloat(v); setVolume(val); videoRef.current.volume=val; setIsMuted(val===0); };
  const toggleMute=()=>{ if(!videoRef.current) return; if(isMuted){videoRef.current.muted=false;videoRef.current.volume=volume||0.5;setIsMuted(false);}else{videoRef.current.muted=true;setIsMuted(true);} };
  const handleSeek=(e)=>{ if(!videoRef.current||!progressRef.current) return; const rect=progressRef.current.getBoundingClientRect(); const pct=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)); videoRef.current.currentTime=pct*(videoRef.current.duration||0); resetTimer(); };
  const toggleFS=()=>{ const el=videoRef.current?.parentElement?.parentElement; if(document.fullscreenElement) document.exitFullscreen(); else el?.requestFullscreen?.(); };
  const handleSub=(idx)=>{ setActiveSub(idx); if(!videoRef.current) return; const tracks=videoRef.current.textTracks; for(let i=0;i<tracks.length;i++){tracks[i].mode=i===idx?'showing':'hidden';} setShowSubMenu(false); };
  const onTimeUpdate=()=>{ if(!videoRef.current) return; setCurrentTime(videoRef.current.currentTime); if(videoRef.current.duration) setDuration(videoRef.current.duration); if(videoRef.current.buffered.length>0) setBuffered(videoRef.current.buffered.end(videoRef.current.buffered.length-1)); };
  const progress=duration>0?(currentTime/duration)*100:0;
  const buffPct=duration>0?(buffered/duration)*100:0;

  return (<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-[200] bg-black flex items-center justify-center" onMouseMove={resetTimer}>
    {loading?<div className="text-center"><Loader2 className="w-12 h-12 animate-spin text-red-600 mx-auto mb-4"/><p className="text-gray-400">Chargement Direct Play...</p></div>:
     error?<div className="text-center max-w-md"><AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4"/><h3 className="text-xl font-bold mb-2">Lecture impossible</h3><p className="text-gray-400 mb-6">{error}</p><Button onClick={onClose} className="bg-white/10 hover:bg-white/20 rounded-xl">Fermer</Button></div>:
    (<div className="w-full h-full relative">
      <video ref={videoRef} src={streamUrl} className="w-full h-full object-contain" autoPlay
        onTimeUpdate={onTimeUpdate} onPlay={()=>setIsPlaying(true)} onPause={()=>{setIsPlaying(false);setShowControls(true);}}
        onLoadedMetadata={(e)=>setDuration(e.target.duration)} onClick={togglePlay}>
        {subtitles.map((s,i)=><track key={i} kind="subtitles" src={s.url} srcLang={s.language} label={s.displayTitle}/>)}
      </video>
      <div className={`absolute inset-0 transition-opacity duration-500 ${showControls?'opacity-100':'opacity-0 pointer-events-none'}`}>
        {/* Top */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-6 flex items-center justify-between">
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20"><ChevronLeft className="w-6 h-6"/></button>
          <h3 className="text-base font-bold truncate flex-1 text-center px-4">{item?.name}</h3><div className="w-10"/></div>
        {/* Center */}
        <div className="absolute inset-0 flex items-center justify-center gap-12 pointer-events-none">
          <button onClick={()=>skip(-10)} className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl flex flex-col items-center justify-center hover:bg-white/20 pointer-events-auto"><SkipBack className="w-5 h-5"/><span className="text-[9px] text-gray-400 mt-0.5">10s</span></button>
          <button onClick={togglePlay} className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center hover:bg-white/30 pointer-events-auto shadow-2xl">{isPlaying?<Pause className="w-10 h-10"/>:<Play className="w-10 h-10 ml-1"/>}</button>
          <button onClick={()=>skip(30)} className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl flex flex-col items-center justify-center hover:bg-white/20 pointer-events-auto"><SkipForward className="w-5 h-5"/><span className="text-[9px] text-gray-400 mt-0.5">30s</span></button></div>
        {/* Bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 pt-16">
          <div className="mb-4 group/prog cursor-pointer" ref={progressRef} onClick={handleSeek}>
            <div className="relative h-1.5 group-hover/prog:h-3 bg-white/15 rounded-full transition-all overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-white/20 rounded-full" style={{width:`${buffPct}%`}}/>
              <div className="absolute inset-y-0 left-0 bg-red-600 rounded-full" style={{width:`${progress}%`}}/>
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-red-600 rounded-full shadow-lg opacity-0 group-hover/prog:opacity-100" style={{left:`${progress}%`}}/></div></div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><span className="text-sm font-mono text-gray-300">{formatTime(currentTime)}</span><span className="text-sm text-gray-600">/</span><span className="text-sm font-mono text-gray-500">{formatTime(duration)}</span></div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 group/vol"><button onClick={toggleMute} className="p-2 rounded-xl hover:bg-white/10">{isMuted||volume===0?<VolumeX className="w-5 h-5 text-gray-400"/>:<Volume2 className="w-5 h-5"/>}</button>
                <div className="w-0 group-hover/vol:w-24 overflow-hidden transition-all duration-300"><input type="range" min="0" max="1" step="0.05" value={isMuted?0:volume} onChange={e=>handleVol(e.target.value)} className="w-24 h-1 appearance-none bg-white/20 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"/></div></div>
              {subtitles.length>0&&<div className="relative"><button onClick={()=>{setShowSubMenu(!showSubMenu);setShowAudioMenu(false);}} className={`p-2 rounded-xl transition-all ${activeSub>=0?'bg-white/20 text-white':'hover:bg-white/10 text-gray-400'}`}><Subtitles className="w-5 h-5"/></button>
                {showSubMenu&&<div className="absolute bottom-12 right-0 glass-strong rounded-2xl p-2 min-w-[200px] max-h-[300px] overflow-y-auto">
                  <button onClick={()=>handleSub(-1)} className={`w-full text-left px-3 py-2 rounded-xl text-sm ${activeSub===-1?'bg-white/10 text-white':'text-gray-400 hover:bg-white/5'}`}>Desactiver</button>
                  {subtitles.map((s,i)=><button key={i} onClick={()=>handleSub(i)} className={`w-full text-left px-3 py-2 rounded-xl text-sm ${activeSub===i?'bg-white/10 text-white':'text-gray-400 hover:bg-white/5'}`}>{s.displayTitle}</button>)}</div>}</div>}
              {audioTracks.length>1&&<div className="relative"><button onClick={()=>{setShowAudioMenu(!showAudioMenu);setShowSubMenu(false);}} className="p-2 rounded-xl hover:bg-white/10 text-gray-400"><AudioLines className="w-5 h-5"/></button>
                {showAudioMenu&&<div className="absolute bottom-12 right-0 glass-strong rounded-2xl p-2 min-w-[200px]">
                  {audioTracks.map((a,i)=><button key={i} className={`w-full text-left px-3 py-2 rounded-xl text-sm ${a.isDefault?'bg-white/10 text-white':'text-gray-400 hover:bg-white/5'}`}>{a.displayTitle} ({a.channels}ch)</button>)}</div>}</div>}
              <button onClick={toggleFS} className="p-2 rounded-xl hover:bg-white/10"><Maximize className="w-5 h-5"/></button></div></div></div></div></div>)}
  </motion.div>);
}

/* =================================================================
   EPISODE CARD
   ================================================================= */
function EpisodeCard({ ep, onPlay }) {
  const [imgErr,setImgErr]=useState(false);
  return (<motion.div whileHover={{scale:1.01}} className="glass-card rounded-2xl overflow-hidden cursor-pointer group" onClick={()=>onPlay(ep.id)}>
    <div className="flex gap-4 p-4">
      <div className="relative w-40 aspect-video rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
        {!imgErr&&(ep.thumbUrl||ep.backdropUrl)?<img src={ep.thumbUrl||ep.backdropUrl} alt={ep.name} className="w-full h-full object-cover" onError={()=>setImgErr(true)}/>:
          <div className="w-full h-full flex items-center justify-center"><PlayCircle className="w-8 h-8 text-gray-600"/></div>}
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"><Play className="w-5 h-5 fill-current"/></div></div>
        {ep.isPlayed&&<div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-lg bg-green-500/80 flex items-center justify-center"><Check className="w-3 h-3"/></div>}</div>
      <div className="flex-1 min-w-0 py-1"><div className="flex items-center gap-2 mb-1"><span className="text-xs text-gray-500 font-mono">E{String(ep.episodeNumber).padStart(2,'0')}</span>{ep.runtime>0&&<span className="text-xs text-gray-600">{ep.runtime} min</span>}</div>
        <h4 className="font-semibold text-white text-sm mb-1.5 truncate">{ep.name}</h4><p className="text-gray-500 text-xs line-clamp-2">{ep.overview}</p></div></div></motion.div>);
}

/* =================================================================
   MEDIA DETAIL VIEW
   ================================================================= */
function MediaDetailView({ item, onBack, onPlay, onItemClick }) {
  const [detail,setDetail]=useState(null); const [similar,setSimilar]=useState([]);
  const [seasons,setSeasons]=useState([]); const [selectedSeason,setSelectedSeason]=useState(null); const [episodes,setEpisodes]=useState([]);
  const [collection,setCollection]=useState(null); const [collectionItems,setCollectionItems]=useState([]);
  const [loading,setLoading]=useState(true); const [loadingEps,setLoadingEps]=useState(false);
  const [imgError,setImgError]=useState(false); const [showPlayer,setShowPlayer]=useState(false); const [playEpId,setPlayEpId]=useState(null);
  const [subs,setSubs]=useState([]); const [audio,setAudio]=useState([]);
  const itemKey=item?.id||item?.tmdbId||'';

  useEffect(()=>{ setDetail(null); setSimilar([]); setSeasons([]); setSelectedSeason(null); setEpisodes([]); setCollection(null); setCollectionItems([]); setSubs([]); setAudio([]); setImgError(false); setLoading(true); fetchAll(); },[itemKey]);

  const fetchAll=async()=>{
    let fi=item;
    if(item.id&&!item.tmdbId){ try{ const r=await cachedApi(`media/detail?id=${item.id}`); if(r.item){setDetail(r.item);fi=r.item;setSimilar(r.similar||[]);} }catch{} } else{ setDetail(item); fi=item; }
    const isSeries=fi?.type==='Series'; const fId=fi?.id; const tmdbId=fi?.tmdbId||fi?.providerIds?.Tmdb;
    if(isSeries&&fId){ try{ const r=await cachedApi(`media/seasons?seriesId=${fId}`); const s=r.seasons||[]; setSeasons(s); if(s.length>0){setSelectedSeason(s[0]);fetchEps(fId,s[0].id);} }catch{} }
    if(!isSeries){ try{ const p=new URLSearchParams(); if(fId) p.set('id',fId); if(tmdbId) p.set('tmdbId',tmdbId); const r=await cachedApi(`media/collection?${p.toString()}`); setCollection(r.collection||null); setCollectionItems(r.items||[]); }catch{} }
    if(fId){ try{ const r=await cachedApi(`media/stream?id=${fId}`); setSubs(r.subtitles||[]); setAudio(r.audioTracks||[]); }catch{} }
    setLoading(false);
  };
  const fetchEps=async(sid,seId)=>{ setLoadingEps(true); try{ const r=await cachedApi(`media/episodes?seriesId=${sid}&seasonId=${seId}`); setEpisodes(r.episodes||[]); }catch{} setLoadingEps(false); };
  const d=detail||item; const isSeries=d?.type==='Series';

  return (<motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="min-h-screen bg-[#050505]">
    <AnimatePresence>{showPlayer&&<VideoPlayer item={d} episodeId={playEpId} onClose={()=>{setShowPlayer(false);setPlayEpId(null);}}/>}</AnimatePresence>
    <div className="relative h-[55vh] min-h-[400px]">
      {!imgError&&d?.backdropUrl?<img src={d.backdropUrl} alt={d.name} className="absolute inset-0 w-full h-full object-cover" onError={()=>setImgError(true)}/>:
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/20 via-gray-900 to-[#050505]"/>}
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/50 to-[#050505]/10"/>
      <button onClick={onBack} className="absolute top-20 left-6 z-20 w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center hover:bg-white/20"><ChevronLeft className="w-5 h-5"/></button></div>

    <div className="relative -mt-56 z-10 px-6 md:px-16 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row gap-10">
        <div className="flex-shrink-0 w-48 md:w-56"><div className="aspect-[2/3] rounded-3xl overflow-hidden shadow-2xl bg-white/5 ring-1 ring-white/10">
          {d?.posterUrl?<img src={d.posterUrl} alt={d.name} className="w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center"><Clapperboard className="w-16 h-16 text-gray-700"/></div>}</div></div>
        <div className="flex-1 pt-4">
          <h1 className="text-3xl md:text-5xl font-black mb-4 leading-tight">{d?.name}</h1>
          <div className="flex flex-wrap items-center gap-2.5 mb-5">
            {d?.year&&<span className="px-3 py-1.5 rounded-xl bg-white/5 text-gray-300 text-sm">{d.year}</span>}
            {d?.runtime>0&&<span className="px-3 py-1.5 rounded-xl bg-white/5 text-gray-300 text-sm flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/>{d.runtime} min</span>}
            {(d?.communityRating||d?.voteAverage)>0&&<span className="px-3 py-1.5 rounded-xl bg-yellow-500/10 text-yellow-400 text-sm flex items-center gap-1.5"><Star className="w-3.5 h-3.5 fill-current"/>{(d.communityRating||d.voteAverage).toFixed(1)}</span>}
            <span className="px-3 py-1.5 rounded-xl bg-white/5 text-gray-300 text-sm flex items-center gap-1.5">{isSeries?<><Tv className="w-3.5 h-3.5"/>Serie</>:<><Film className="w-3.5 h-3.5"/>Film</>}</span>
            {isSeries&&seasons.length>0&&<span className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-300 text-sm flex items-center gap-1.5"><Layers className="w-3.5 h-3.5"/>{seasons.length} saison{seasons.length>1?'s':''}</span>}
          </div>
          {(d?.genres||[]).length>0&&<div className="flex flex-wrap gap-2 mb-5">{d.genres.map(g=><span key={g} className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-300 text-sm border border-red-500/10">{GENRE_EMOJIS[g]} {g}</span>)}</div>}
          {d?.dagzRank>0&&<div className="mb-5 inline-flex items-center gap-3 glass rounded-2xl px-5 py-3"><Sparkles className="w-5 h-5 text-red-400"/><span className="text-red-300 font-bold">DagzRank</span><div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full" style={{width:`${d.dagzRank}%`}}/></div><span className="text-red-400 font-bold">{d.dagzRank}%</span></div>}
          <div className="flex flex-wrap items-center gap-3 mb-6"><SmartButton item={d} onPlay={()=>setShowPlayer(true)}/><TrailerButton item={d}/></div>
          <p className="text-gray-400 leading-relaxed mb-6 max-w-2xl font-light">{d?.overview}</p>
          {(subs.length>0||audio.length>0)&&<div className="flex flex-wrap gap-4 mb-6">
            {subs.length>0&&<div className="flex items-center gap-2 text-sm text-gray-500"><Subtitles className="w-4 h-4"/>{subs.length} sous-titre{subs.length>1?'s':''}</div>}
            {audio.length>0&&<div className="flex items-center gap-2 text-sm text-gray-500"><AudioLines className="w-4 h-4"/>{audio.length} piste{audio.length>1?'s':''} audio</div>}</div>}
          {(d?.people||[]).length>0&&<div className="mb-6"><h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Distribution</h3>
            <div className="flex flex-wrap gap-2">{d.people.filter(p=>p.type==='Actor').slice(0,8).map((p,i)=><span key={i} className="px-3 py-1.5 rounded-xl bg-white/3 text-gray-300 text-sm border border-white/5">{p.name}</span>)}</div></div>}
        </div></div>
      {isSeries&&seasons.length>0&&(<div className="mt-14"><h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Layers className="w-5 h-5 text-purple-400"/>Saisons et Episodes</h2>
        <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar pb-2">{seasons.map(s=><button key={s.id} onClick={()=>{setSelectedSeason(s);fetchEps(d.id,s.id);}} className={`px-5 py-2.5 rounded-2xl text-sm font-medium transition-all whitespace-nowrap ${selectedSeason?.id===s.id?'bg-white text-black shadow-lg':'bg-white/5 text-gray-400 hover:bg-white/10'}`}>{s.name}<span className="ml-1.5 text-xs opacity-60">({s.episodeCount})</span></button>)}</div>
        {loadingEps?<div className="grid gap-3">{Array.from({length:4}).map((_,i)=><div key={i} className="h-28 skeleton"/>)}</div>:
          <div className="grid gap-3">{episodes.map(ep=><EpisodeCard key={ep.id} ep={ep} onPlay={(id)=>{setPlayEpId(id);setShowPlayer(true);}}/>)}{episodes.length===0&&<div className="text-center py-12 text-gray-600"><p>Aucun episode disponible</p></div>}</div>}</div>)}
      {collection&&collectionItems.length>0&&(<div className="mt-14"><h2 className="text-xl font-bold mb-2 flex items-center gap-2"><Layers className="w-5 h-5 text-amber-400"/>{collection.name}</h2>
        {collection.overview&&<p className="text-gray-500 text-sm mb-6 max-w-2xl">{collection.overview}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">{collectionItems.map((ci,idx)=>(
          <motion.div key={ci.id||idx} whileHover={{scale:1.05,y:-4}} className={`cursor-pointer ${ci.isCurrent?'ring-2 ring-red-500 rounded-2xl':''}`} onClick={()=>{if(!ci.isCurrent) onItemClick(ci);}}>
            <div className="aspect-[2/3] rounded-2xl overflow-hidden bg-white/3 relative shadow-lg">{ci.posterUrl?<img src={ci.posterUrl} alt={ci.name} className="w-full h-full object-cover" loading="lazy"/>:<div className="w-full h-full flex items-center justify-center"><Clapperboard className="w-8 h-8 text-gray-700"/></div>}
              {ci.isCurrent&&<div className="absolute inset-0 bg-red-600/10 flex items-center justify-center"><Badge className="bg-red-600 text-white">Actuel</Badge></div>}</div>
            <p className="text-sm text-gray-400 mt-2 truncate font-medium">{ci.name}</p></motion.div>))}</div></div>)}
      {similar.length>0&&<div className="mt-14"><MediaRow title="Similaire" items={similar} icon={<Film className="w-5 h-5 text-gray-500"/>} onItemClick={onItemClick}/></div>}
    </div><div className="h-24"/></motion.div>);
}

/* =================================================================
   THE WIZARD - Le Magicien (Interactive Discovery Assistant)
   ================================================================= */
function WizardView({ mediaType, onItemClick }) {
  const [step,setStep]=useState(1); const [mood,setMood]=useState(''); const [era,setEra]=useState(''); const [duration,setDuration]=useState('');
  const [loading,setLoading]=useState(false); const [result,setResult]=useState(null); const [alternatives,setAlternatives]=useState([]);

  const isTV = mediaType==='series';
  const MOODS = [
    { id:'action', label:'Action', icon:Sparkles, color:'from-orange-600 to-red-600', desc:'Explosions et adrealine' },
    { id:'think', label:'Reflechir', icon:Brain, color:'from-blue-600 to-indigo-600', desc:'Mystere et introspection' },
    { id:'laugh', label:'Rire', icon:Laugh, color:'from-yellow-500 to-orange-500', desc:'Humour et bonne humeur' },
    { id:'shiver', label:'Frissonner', icon:Ghost, color:'from-purple-600 to-violet-700', desc:'Horreur et suspense' },
    { id:'cry', label:'Pleurer', icon:Frown, color:'from-pink-600 to-rose-600', desc:'Emotion et romance' },
  ];
  const ERAS = [
    { id:'classic', label:'Classique', desc:'Avant 2000' },
    { id:'2000s', label:'Annees 2000-2015', desc:'Le millenaire' },
    { id:'recent', label:'Recent', desc:'Apres 2015' },
    { id:'any', label:'Peu importe', desc:'Toutes epoques' },
  ];
  const DURATIONS = [
    { id:'short', label:'< 1h30', desc:'Court et efficace' },
    { id:'medium', label:'~2h', desc:'Le classique' },
    { id:'long', label:'Epique !', desc:'Seigneur des Anneaux style' },
    { id:'any', label:'Peu importe', desc:'Le temps n\'est rien' },
  ];

  const discover=async()=>{
    setLoading(true); setResult(null); setAlternatives([]);
    try {
      const r=await api('wizard/discover',{method:'POST',body:JSON.stringify({mood,era,duration:duration,mediaType:isTV?'tv':'movie'})});
      setResult(r.perfectMatch); setAlternatives(r.alternatives||[]);
    } catch(e){ console.error(e); }
    setLoading(false);
  };

  const reset=()=>{setStep(1);setMood('');setEra('');setDuration('');setResult(null);setAlternatives([]);};

  // Auto-trigger search when step 3 is answered
  useEffect(()=>{ if(step===4&&mood&&era&&duration) discover(); },[step]);

  return (<div className="pt-8">
    <AnimatePresence mode="wait">
      {/* Step 1: Mood */}
      {step===1&&(<motion.div key="w1" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} className="text-center">
        <div className="w-20 h-20 bg-purple-600/15 rounded-3xl flex items-center justify-center mx-auto mb-6"><Wand2 className="w-10 h-10 text-purple-400"/></div>
        <h2 className="text-2xl font-bold mb-2">Quelle est ton humeur ?</h2>
        <p className="text-gray-500 mb-8">Dis-moi ce que tu ressens ce soir</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-3xl mx-auto">
          {MOODS.map(m=>(<button key={m.id} onClick={()=>{setMood(m.id);setStep(2);}}
            className="glass-card rounded-3xl p-6 text-center hover:scale-105 transition-all group">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${m.color} flex items-center justify-center mx-auto mb-4 group-hover:shadow-lg transition-all`}>
              <m.icon className="w-7 h-7 text-white"/></div>
            <h3 className="font-bold text-white mb-1">{m.label}</h3>
            <p className="text-xs text-gray-500">{m.desc}</p></button>))}
        </div></motion.div>)}

      {/* Step 2: Era */}
      {step===2&&(<motion.div key="w2" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} className="text-center">
        <div className="w-20 h-20 bg-blue-600/15 rounded-3xl flex items-center justify-center mx-auto mb-6"><CalendarDays className="w-10 h-10 text-blue-400"/></div>
        <h2 className="text-2xl font-bold mb-2">De quelle epoque ?</h2>
        <p className="text-gray-500 mb-8">Choisis la periode qui te parle</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
          {ERAS.map(e=>(<button key={e.id} onClick={()=>{setEra(e.id);setStep(3);}}
            className="glass-card rounded-3xl p-6 text-center hover:scale-105 transition-all">
            <h3 className="font-bold text-white mb-1">{e.label}</h3>
            <p className="text-xs text-gray-500">{e.desc}</p></button>))}
        </div>
        <button onClick={()=>setStep(1)} className="mt-6 text-gray-600 hover:text-gray-400 text-sm flex items-center gap-1 mx-auto"><ChevronLeft className="w-4 h-4"/>Retour</button>
      </motion.div>)}

      {/* Step 3: Duration */}
      {step===3&&(<motion.div key="w3" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} className="text-center">
        <div className="w-20 h-20 bg-green-600/15 rounded-3xl flex items-center justify-center mx-auto mb-6"><Timer className="w-10 h-10 text-green-400"/></div>
        <h2 className="text-2xl font-bold mb-2">Combien de temps as-tu ?</h2>
        <p className="text-gray-500 mb-8">On adapte la duree a ton planning</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
          {DURATIONS.map(d=>(<button key={d.id} onClick={()=>{setDuration(d.id);setStep(4);}}
            className="glass-card rounded-3xl p-6 text-center hover:scale-105 transition-all">
            <h3 className="font-bold text-white mb-1">{d.label}</h3>
            <p className="text-xs text-gray-500">{d.desc}</p></button>))}
        </div>
        <button onClick={()=>setStep(2)} className="mt-6 text-gray-600 hover:text-gray-400 text-sm flex items-center gap-1 mx-auto"><ChevronLeft className="w-4 h-4"/>Retour</button>
      </motion.div>)}

      {/* Step 4: Results */}
      {step===4&&(<motion.div key="w4" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}}>
        {loading?(<div className="text-center py-20">
          <motion.div animate={{rotate:360}} transition={{duration:2,repeat:Infinity,ease:'linear'}} className="w-20 h-20 mx-auto mb-6">
            <Wand2 className="w-20 h-20 text-purple-400"/></motion.div>
          <h2 className="text-xl font-bold mb-2">Le Magicien cherche...</h2><p className="text-gray-500">Analyse de tes gouts en cours</p></div>
        ):result?(<div>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Nous avons trouve LE {isTV?'programme':'film'} parfait pour toi</h2>
            <p className="text-gray-500">Base sur ton humeur, tes preferences et notre algorithme</p></div>
          {/* Featured result */}
          <div className="relative max-w-4xl mx-auto mb-12 rounded-3xl overflow-hidden glass-strong">
            <div className="flex flex-col md:flex-row">
              {result.backdropUrl&&<div className="absolute inset-0"><img src={result.backdropUrl} alt="" className="w-full h-full object-cover opacity-20"/><div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/80 to-transparent"/></div>}
              <div className="relative flex flex-col md:flex-row gap-8 p-8">
                <div className="w-40 md:w-52 flex-shrink-0">{result.posterUrl&&<img src={result.posterUrl} alt={result.name} className="w-full rounded-2xl shadow-2xl"/>}</div>
                <div className="flex-1">
                  <Badge className="bg-purple-600 text-white mb-3"><Wand2 className="w-3 h-3 mr-1"/>Match parfait</Badge>
                  <h3 className="text-3xl font-black mb-3">{result.name}</h3>
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    {result.year&&<span className="text-gray-400">{result.year}</span>}
                    {result.voteAverage>0&&<span className="flex items-center gap-1 text-yellow-400"><Star className="w-4 h-4 fill-current"/>{result.voteAverage.toFixed(1)}</span>}
                  </div>
                  <p className="text-gray-300 mb-6 leading-relaxed line-clamp-4">{result.overview}</p>
                  <Button onClick={()=>onItemClick(result)} className="bg-white hover:bg-gray-100 text-black font-bold px-8 h-12 rounded-xl">
                    <Info className="w-5 h-5 mr-2"/>Voir les details</Button></div></div></div>
          {/* Alternatives */}
          {alternatives.length>0&&(<div className="mt-6"><h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-400"/>Autres suggestions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">{alternatives.slice(0,6).map((a,i)=><MediaCard key={a.id||i} item={a} onClick={onItemClick}/>)}</div></div>)}
          <div className="text-center mt-8"><Button onClick={reset} variant="outline" className="border-white/10 text-gray-300 rounded-xl"><Wand2 className="w-4 h-4 mr-2"/>Relancer le Magicien</Button></div>
        </div>):(<div className="text-center py-20"><AlertCircle className="w-16 h-16 text-gray-700 mx-auto mb-4"/><h3 className="text-xl font-bold mb-2">Aucun resultat</h3><p className="text-gray-500 mb-6">Le Magicien n'a rien trouve. Essaie d'autres criteres !</p>
          <Button onClick={reset} variant="outline" className="border-white/10 text-gray-300 rounded-xl"><Wand2 className="w-4 h-4 mr-2"/>Reessayer</Button></div>)}
      </motion.div>)}
    </AnimatePresence>
  </div>);
}

/* =================================================================
   FILMS / SERIES PAGE - 4 Tabs: Search, DagzRank, Library, Wizard
   ================================================================= */
function MediaTypePage({ mediaType, onItemClick, onPlay }) {
  const [tab,setTab]=useState('library');
  const isTV = mediaType==='series';
  const label = isTV?'Series':'Films';
  const jellyfinType = isTV?'Series':'Movie';

  // Tab: Search
  const [searchQ,setSearchQ]=useState(''); const [searchResults,setSearchResults]=useState([]); const [searchLoading,setSearchLoading]=useState(false);
  const doSearch=async(q)=>{ if(!q.trim()) return; setSearchLoading(true); try { const r=await cachedApi(`search?q=${encodeURIComponent(q)}&mediaType=${isTV?'tv':'movie'}`); setSearchResults((r.results||[]).filter(i=>isTV?i.type==='Series'||i.mediaType==='tv':i.type==='Movie'||i.mediaType==='movie')); } catch{} setSearchLoading(false); };

  // Tab: DagzRank
  const [recos,setRecos]=useState([]); const [recoLoading,setRecoLoading]=useState(false);
  const loadRecos=async()=>{ setRecoLoading(true); try { const r=await cachedApi('recommendations'); setRecos((r.recommendations||[]).filter(i=>isTV?i.type==='Series':i.type==='Movie')); } catch{} setRecoLoading(false); };

  // Tab: Library
  const [library,setLibrary]=useState([]); const [libLoading,setLibLoading]=useState(false);
  const loadLib=async()=>{ setLibLoading(true); try { const r=await cachedApi(`media/library?type=${jellyfinType}&limit=60&sortBy=SortName&sortOrder=Ascending`); setLibrary(r.items||[]); } catch{} setLibLoading(false); };

  useEffect(()=>{
    if(tab==='dagzrank') loadRecos();
    if(tab==='library') loadLib();
  },[tab]);

  // Load library on mount
  useEffect(()=>{ loadLib(); },[]);

  const TABS = [
    { id:'library', label:'Ma Bibliotheque', icon:Library },
    { id:'search', label:'Recherche', icon:Search },
    { id:'dagzrank', label:'DagzRank', icon:Sparkles },
    { id:'wizard', label:'Le Magicien', icon:Wand2 },
  ];

  return (<div className="pt-24 px-6 md:px-16 min-h-screen">
    <h1 className="text-3xl md:text-4xl font-black mb-6 flex items-center gap-3">{isTV?<Tv className="w-8 h-8 text-green-400"/>:<Film className="w-8 h-8 text-blue-400"/>}{label}</h1>

    {/* Tabs */}
    <div className="flex gap-2 mb-8 overflow-x-auto hide-scrollbar pb-2">
      {TABS.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)}
        className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-medium transition-all whitespace-nowrap ${
          tab===t.id?'bg-white text-black shadow-lg':'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
        <t.icon className="w-4 h-4"/>{t.label}</button>))}
    </div>

    <AnimatePresence mode="wait">
      {/* Search tab */}
      {tab==='search'&&(<motion.div key="search" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
        <form onSubmit={(e)=>{e.preventDefault();doSearch(searchQ);}} className="mb-8 max-w-2xl"><div className="relative">
          <Input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder={`Rechercher un ${isTV?'serie':'film'}...`}
            className="bg-white/5 border-white/10 text-white h-14 pl-14 text-lg rounded-2xl" autoFocus/>
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"/></div></form>
        {searchLoading?<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">{Array.from({length:12}).map((_,i)=><div key={i}><div className="aspect-[2/3] skeleton"/></div>)}</div>:
          searchResults.length>0?<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">{searchResults.map((item,i)=><MediaCard key={item.id||i} item={item} onClick={onItemClick}/>)}</div>:
          searchQ?<div className="text-center py-16"><Search className="w-12 h-12 text-gray-800 mx-auto mb-3"/><p className="text-gray-500">Aucun resultat</p></div>:
          <div className="text-center py-16"><Search className="w-12 h-12 text-gray-800 mx-auto mb-3"/><p className="text-gray-500">Tapez pour rechercher des {label.toLowerCase()}</p></div>}
      </motion.div>)}

      {/* DagzRank tab */}
      {tab==='dagzrank'&&(<motion.div key="dagzrank" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
        <div className="flex items-center gap-2 mb-6"><Sparkles className="w-5 h-5 text-red-500"/><h2 className="text-lg font-bold">Recommandations personnalisees</h2></div>
        {recoLoading?<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">{Array.from({length:12}).map((_,i)=><div key={i}><div className="aspect-[2/3] skeleton"/></div>)}</div>:
          recos.length>0?<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">{recos.map((item,i)=><MediaCard key={item.id||i} item={item} onClick={onItemClick}/>)}</div>:
          <div className="text-center py-16"><Sparkles className="w-12 h-12 text-gray-800 mx-auto mb-3"/><p className="text-gray-500">Aucune recommandation disponible</p></div>}
      </motion.div>)}

      {/* Library tab */}
      {tab==='library'&&(<motion.div key="library" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
        <div className="flex items-center gap-2 mb-6"><Library className="w-5 h-5 text-blue-400"/><h2 className="text-lg font-bold">Disponible sur votre serveur</h2></div>
        {libLoading?<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">{Array.from({length:12}).map((_,i)=><div key={i}><div className="aspect-[2/3] skeleton"/></div>)}</div>:
          library.length>0?<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">{library.map((item,i)=><MediaCard key={item.id||i} item={item} onClick={onItemClick}/>)}</div>:
          <div className="text-center py-16"><Library className="w-12 h-12 text-gray-800 mx-auto mb-3"/><p className="text-gray-500">Aucun {isTV?'serie':'film'} dans la bibliotheque</p></div>}
      </motion.div>)}

      {/* Wizard tab */}
      {tab==='wizard'&&(<motion.div key="wizard" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
        <WizardView mediaType={mediaType} onItemClick={onItemClick}/>
      </motion.div>)}
    </AnimatePresence>
  </div>);
}

/* =================================================================
   SEARCH VIEW (global)
   ================================================================= */
function SearchView({ query, onItemClick }) {
  const [results,setResults]=useState([]); const [loading,setLoading]=useState(true); const [si,setSi]=useState(query);
  useEffect(()=>{if(query) doSearch(query);},[query]);
  const doSearch=async(q)=>{setLoading(true); try{const r=await cachedApi(`search?q=${encodeURIComponent(q)}`);setResults(r.results||[]);}catch{} setLoading(false);};
  return (<div className="pt-24 px-6 md:px-16 min-h-screen">
    <form onSubmit={(e)=>{e.preventDefault();if(si.trim()) doSearch(si.trim());}} className="mb-10 max-w-2xl"><div className="relative">
      <Input value={si} onChange={e=>setSi(e.target.value)} placeholder="Rechercher..." className="bg-white/5 border-white/10 text-white h-14 pl-14 text-lg rounded-2xl" autoFocus/>
      <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"/></div></form>
    {loading?<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">{Array.from({length:12}).map((_,i)=><div key={i}><div className="aspect-[2/3] skeleton"/></div>)}</div>:
      results.length>0?<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">{results.map((item,i)=><MediaCard key={item.id||i} item={item} onClick={onItemClick}/>)}</div>:
      <div className="text-center py-24"><Search className="w-16 h-16 text-gray-800 mx-auto mb-4"/><h3 className="text-xl text-gray-500">Aucun resultat</h3></div>}
  </div>);
}

/* =================================================================
   DASHBOARD VIEW
   ================================================================= */
function DashboardView({ user, onItemClick, onPlay }) {
  const [reco,setReco]=useState([]); const [movies,setMovies]=useState([]); const [series,setSeries]=useState([]);
  const [trendM,setTrendM]=useState([]); const [trendS,setTrendS]=useState([]);
  const [heroItem,setHeroItem]=useState(null); const heroRef=useRef(null);
  const [loads,setLoads]=useState({reco:true,movies:true,series:true,trendM:true,trendS:true});

  useEffect(()=>{load();},[]);
  const load=async()=>{
    const sl=(k,v)=>setLoads(p=>({...p,[k]:v}));
    sl('reco',true); cachedApi('recommendations').then(r=>{const recs=r.recommendations||[];setReco(recs);if(recs.length>0&&!heroRef.current){heroRef.current=recs[0];setHeroItem(recs[0]);}sl('reco',false);}).catch(()=>sl('reco',false));
    sl('movies',true); cachedApi('media/library?type=Movie&limit=20&sortBy=DateCreated&sortOrder=Descending').then(r=>{const i=r.items||[];setMovies(i);if(!heroRef.current&&i.length>0){heroRef.current=i[0];setHeroItem(i[0]);}sl('movies',false);}).catch(()=>sl('movies',false));
    sl('series',true); cachedApi('media/library?type=Series&limit=20&sortBy=DateCreated&sortOrder=Descending').then(r=>{setSeries(r.items||[]);sl('series',false);}).catch(()=>sl('series',false));
    sl('trendM',true); cachedApi('discover?type=movies').then(r=>{setTrendM(r.results||[]);sl('trendM',false);}).catch(()=>sl('trendM',false));
    sl('trendS',true); cachedApi('discover?type=tv').then(r=>{setTrendS(r.results||[]);sl('trendS',false);}).catch(()=>sl('trendS',false));
  };

  return (<div className="min-h-screen">
    <HeroSection item={heroItem} onPlay={onPlay} onDetail={onItemClick}/>
    <div className="-mt-12 relative z-10">
      <MediaRow title="Recommande pour vous" items={reco} icon={<Sparkles className="w-5 h-5 text-red-500"/>} onItemClick={onItemClick} loading={loads.reco} size="large"/>
      <MediaRow title="Films recents" items={movies} icon={<Film className="w-5 h-5 text-blue-400"/>} onItemClick={onItemClick} loading={loads.movies}/>
      <MediaRow title="Series recentes" items={series} icon={<Tv className="w-5 h-5 text-green-400"/>} onItemClick={onItemClick} loading={loads.series}/>
      <MediaRow title="Tendances Films" items={trendM} icon={<TrendingUp className="w-5 h-5 text-orange-400"/>} onItemClick={onItemClick} loading={loads.trendM}/>
      <MediaRow title="Tendances Series" items={trendS} icon={<TrendingUp className="w-5 h-5 text-purple-400"/>} onItemClick={onItemClick} loading={loads.trendS}/>
    </div><div className="h-20"/></div>);
}

/* =================================================================
   MAIN APP
   ================================================================= */
export default function App() {
  const [view,setView]=useState('loading'); const [user,setUser]=useState(null);
  const [selectedItem,setSelectedItem]=useState(null); const [searchQuery,setSearchQuery]=useState('');
  const [showGlobalPlayer,setShowGlobalPlayer]=useState(false);

  useEffect(()=>{init();},[]);
  const init=async()=>{
    try { const s=await cachedApi('setup/check'); if(!s.setupComplete){setView('setup');return;} const sess=await cachedApi('auth/session');
      if(sess.authenticated){setUser(sess.user);setView(sess.onboardingComplete?'dashboard':'onboarding');} else setView('login');
    } catch{setView('setup');} };

  const handleLogin=(u,done)=>{setUser(u);setView(done?'dashboard':'onboarding');};
  const handleItemClick=(item)=>{setSelectedItem(item);setView('detail');window.scrollTo(0,0);};
  const handlePlay=(item)=>{setSelectedItem(item);setShowGlobalPlayer(true);};
  const handleSearch=(q)=>{setSearchQuery(q);setView('search');};
  const handleNav=(t)=>{setView(t);window.scrollTo(0,0);};

  return (<div className="min-h-screen bg-[#050505] text-white">
    <AnimatePresence>{showGlobalPlayer&&selectedItem&&<VideoPlayer item={selectedItem} onClose={()=>setShowGlobalPlayer(false)}/>}</AnimatePresence>
    <AnimatePresence mode="wait">
      {view==='loading'&&<LoadingScreen key="loading"/>}
      {view==='setup'&&<SetupView key="setup" onComplete={()=>setView('login')}/>}
      {view==='login'&&<LoginView key="login" onLogin={handleLogin}/>}
      {view==='onboarding'&&<OnboardingView key="onboarding" onComplete={()=>setView('dashboard')}/>}
      {(view==='dashboard'||view==='movies'||view==='series'||view==='search'||view==='detail')&&(
        <div key="main">
          <Navbar user={user} onSearch={handleSearch} onNavigate={handleNav} currentView={view}/>
          {view==='dashboard'&&<DashboardView user={user} onItemClick={handleItemClick} onPlay={handlePlay}/>}
          {view==='movies'&&<MediaTypePage mediaType="movies" onItemClick={handleItemClick} onPlay={handlePlay}/>}
          {view==='series'&&<MediaTypePage mediaType="series" onItemClick={handleItemClick} onPlay={handlePlay}/>}
          {view==='search'&&<SearchView query={searchQuery} onItemClick={handleItemClick}/>}
          {view==='detail'&&selectedItem&&<MediaDetailView item={selectedItem} onBack={()=>{setView('dashboard');window.scrollTo(0,0);}} onPlay={handlePlay} onItemClick={handleItemClick}/>}
        </div>)}
    </AnimatePresence>
  </div>);
}
