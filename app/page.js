'use client';

import { useState, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { cachedApi } from '@/lib/api';
import { LoadingScreen } from '@/components/dagzflix/LoadingScreen';
import { SetupView } from '@/components/dagzflix/SetupView';
import { LoginView } from '@/components/dagzflix/LoginView';
import { OnboardingView } from '@/components/dagzflix/OnboardingView';
import { Navbar } from '@/components/dagzflix/Navbar';
import { DashboardView } from '@/components/dagzflix/DashboardView';
import { MediaTypePage } from '@/components/dagzflix/MediaTypePage';
import { SearchView } from '@/components/dagzflix/SearchView';
import { MediaDetailView } from '@/components/dagzflix/MediaDetailView';
import { VideoPlayer } from '@/components/dagzflix/VideoPlayer';

/* Navigation history for smart back button */
function useNavHistory() {
  const stack = useRef([]);
  const push = useCallback((view) => { stack.current.push(view); }, []);
  const pop = useCallback(() => stack.current.pop() || 'dashboard', []);
  const clear = useCallback(() => { stack.current = []; }, []);
  return { push, pop, clear };
}

export default function App() {
  const [view, setView] = useState('loading');
  const [user, setUser] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGlobalPlayer, setShowGlobalPlayer] = useState(false);
  const [initDone, setInitDone] = useState(false);
  const nav = useNavHistory();

  // Init on mount
  if (!initDone) {
    setInitDone(true);
    (async () => {
      try {
        const s = await cachedApi('setup/check');
        if (!s.setupComplete) { setView('setup'); return; }
        const sess = await cachedApi('auth/session');
        if (sess.authenticated) {
          setUser(sess.user);
          setView(sess.onboardingComplete ? 'dashboard' : 'onboarding');
        } else {
          setView('login');
        }
      } catch { setView('setup'); }
    })();
  }

  const handleLogin = (u, done) => { setUser(u); setView(done ? 'dashboard' : 'onboarding'); };

  const handleItemClick = (item) => {
    nav.push(view); // save current view before navigating
    setSelectedItem(item);
    setView('detail');
    window.scrollTo(0, 0);
  };

  const handlePlay = (item) => { setSelectedItem(item); setShowGlobalPlayer(true); };

  const handleSearch = (q) => {
    nav.push(view);
    setSearchQuery(q);
    setView('search');
  };

  const handleNav = (target) => {
    nav.clear(); // reset stack on explicit nav
    setView(target);
    window.scrollTo(0, 0);
  };

  const handleBack = () => {
    const prev = nav.pop();
    setView(prev);
    window.scrollTo(0, 0);
  };

  const isMainView = ['dashboard', 'movies', 'series', 'search', 'detail'].includes(view);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <AnimatePresence>
        {showGlobalPlayer && selectedItem && (
          <VideoPlayer item={selectedItem} onClose={() => setShowGlobalPlayer(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {view === 'loading' && <LoadingScreen key="loading" />}
        {view === 'setup' && <SetupView key="setup" onComplete={() => setView('login')} />}
        {view === 'login' && <LoginView key="login" onLogin={handleLogin} />}
        {view === 'onboarding' && <OnboardingView key="onboarding" onComplete={() => setView('dashboard')} />}
        {isMainView && (
          <div key="main">
            <Navbar user={user} onSearch={handleSearch} onNavigate={handleNav} currentView={view} />
            {view === 'dashboard' && <DashboardView user={user} onItemClick={handleItemClick} onPlay={handlePlay} />}
            {view === 'movies' && <MediaTypePage mediaType="movies" onItemClick={handleItemClick} onPlay={handlePlay} />}
            {view === 'series' && <MediaTypePage mediaType="series" onItemClick={handleItemClick} onPlay={handlePlay} />}
            {view === 'search' && <SearchView query={searchQuery} onItemClick={handleItemClick} />}
            {view === 'detail' && selectedItem && (
              <MediaDetailView item={selectedItem} onBack={handleBack} onPlay={handlePlay} onItemClick={handleItemClick} />
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
