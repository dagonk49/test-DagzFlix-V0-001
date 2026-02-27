import { Sparkles, Brain, Laugh, Ghost, Frown } from 'lucide-react';

export const GENRE_LIST = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music',
  'Mystery', 'Romance', 'Science Fiction', 'Thriller', 'War', 'Western',
];

export const GENRE_ICONS = {
  Action: '\uD83D\uDCA5', Adventure: '\uD83D\uDDFA\uFE0F', Animation: '\uD83C\uDFA8',
  Comedy: '\uD83D\uDE02', Crime: '\uD83D\uDD0D', Documentary: '\uD83D\uDCF9',
  Drama: '\uD83C\uDFAD', Family: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66',
  Fantasy: '\uD83E\uDDD9', History: '\uD83D\uDCDC', Horror: '\uD83D\uDC7B',
  Music: '\uD83C\uDFB5', Mystery: '\uD83D\uDD75\uFE0F', Romance: '\uD83D\uDC95',
  'Science Fiction': '\uD83D\uDE80', Thriller: '\uD83D\uDE30', War: '\u2694\uFE0F',
  Western: '\uD83E\uDD20',
};

export const transition = { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] };

export const pageVariants = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
};

export function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

export const MOODS = [
  { id: 'action', label: 'Action', icon: Sparkles, color: 'from-orange-600 to-red-600', desc: "Explosions et adr\u00E9naline" },
  { id: 'think', label: 'R\u00E9fl\u00E9chir', icon: Brain, color: 'from-blue-600 to-indigo-600', desc: 'Myst\u00E8re et introspection' },
  { id: 'laugh', label: 'Rire', icon: Laugh, color: 'from-yellow-500 to-orange-500', desc: 'Humour et bonne humeur' },
  { id: 'shiver', label: 'Frissonner', icon: Ghost, color: 'from-purple-600 to-violet-700', desc: 'Horreur et suspense' },
  { id: 'cry', label: 'Pleurer', icon: Frown, color: 'from-pink-600 to-rose-600', desc: '\u00C9motion et romance' },
];

export const ERAS = [
  { id: 'classic', label: 'Classique', desc: 'Avant 2000' },
  { id: '2000s', label: 'Ann\u00E9es 2000-2015', desc: 'Le mill\u00E9naire' },
  { id: 'recent', label: 'R\u00E9cent', desc: 'Apr\u00E8s 2015' },
  { id: 'any', label: 'Peu importe', desc: 'Toutes \u00E9poques' },
];

export const DURATIONS = [
  { id: 'short', label: '< 1h30', desc: 'Court et efficace' },
  { id: 'medium', label: '~2h', desc: 'Le classique' },
  { id: 'long', label: '\u00C9pique !', desc: 'Seigneur des Anneaux style' },
  { id: 'any', label: 'Peu importe', desc: "Le temps n'est rien" },
];
