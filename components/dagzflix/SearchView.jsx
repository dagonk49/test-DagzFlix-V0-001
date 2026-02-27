'use client';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { cachedApi } from '@/lib/api';
import { MediaCard } from './MediaCard';

export function SearchView({ query, onItemClick }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [si, setSi] = useState(query);

  useEffect(() => { if (query) doSearch(query); }, [query]);

  const doSearch = async (q) => {
    setLoading(true);
    try { const r = await cachedApi(`search?q=${encodeURIComponent(q)}`); setResults(r.results || []); } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div data-testid="search-view" className="pt-24 px-6 md:px-16 min-h-screen">
      <form onSubmit={(e) => { e.preventDefault(); if (si.trim()) doSearch(si.trim()); }} className="mb-10 max-w-2xl">
        <div className="relative">
          <Input data-testid="global-search-input" value={si} onChange={e => setSi(e.target.value)} placeholder="Rechercher..."
            className="bg-white/5 border-white/10 text-white h-14 pl-14 text-lg rounded-2xl" autoFocus />
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        </div>
      </form>
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
          {Array.from({ length: 12 }).map((_, i) => <div key={i}><div className="aspect-[2/3] skeleton" /></div>)}
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
          {results.map((item, i) => <MediaCard key={item.id || i} item={item} onClick={onItemClick} />)}
        </div>
      ) : (
        <div className="text-center py-24"><Search className="w-16 h-16 text-gray-800 mx-auto mb-4" /><h3 className="text-xl text-gray-500">Aucun r\u00E9sultat</h3></div>
      )}
    </div>
  );
}
