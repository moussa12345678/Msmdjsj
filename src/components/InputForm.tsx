import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store';

export function InputForm() {
  const { t } = useTranslation();
  const [platform, setPlatform] = useState('lichess');
  const [input, setInput] = useState('');
  const { setIsLoading, setAnalysisData, setError, tier } = useStore();
  const [maxGames, setMaxGames] = useState(100);

  const maxAllowed = tier === 'free' ? 300 : 2000;

  useEffect(() => {
    if (maxGames > maxAllowed) setMaxGames(maxAllowed);
  }, [tier, maxAllowed, maxGames]);

  useEffect(() => {
    if (!localStorage.getItem('device_id')) {
      localStorage.setItem('device_id', crypto.randomUUID());
    }
  }, []);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setAnalysisData(null);

    const deviceId = localStorage.getItem('device_id') || 'unknown';
    const appUrl = import.meta.env.VITE_APP_URL || '';
    const apiUrl = import.meta.env.VITE_SUPABASE_URL 
      ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze`
      : '/api/analyze';

    const headers = {
      'Content-Type': 'application/json',
      'x-device-id': deviceId,
      ...(localStorage.getItem('internal_tier') ? { 'x-internal-tier': localStorage.getItem('internal_tier')! } : {}),
      ...(localStorage.getItem('internal_secret') ? { 'x-internal-secret': localStorage.getItem('internal_secret')! } : {})
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          platform,
          input,
          filters: { maxGames }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.reason === 'daily_limit') throw new Error(JSON.stringify({ reason: 'daily_limit', message: t('daily_limit'), retryAfterSeconds: data.retryAfterSeconds }));
        if (data.reason === 'burst_lock') throw new Error(JSON.stringify({ reason: 'burst_lock', message: t('burst_lock'), retryAfterSeconds: data.retryAfterSeconds }));
        throw new Error(JSON.stringify({ reason: 'unknown', message: data.error || 'Analysis failed' }));
      }

      if (data.tier) {
        useStore.getState().setTier(data.tier);
      }

      if (data.status === 'ready') {
        setAnalysisData(data.data);
        setIsLoading(false);
        
        if (data.refreshing && data.cacheKey) {
          const cacheKey = data.cacheKey;
          const poll = async () => {
            try {
              const queryParams = new URLSearchParams({
                cacheKey,
                platform,
                input,
                maxGames: maxGames.toString()
              }).toString();
              const pollRes = await fetch(`${apiUrl}?${queryParams}`, { headers });
              const pollData = await pollRes.json();
              if (pollData.status === 'ready') {
                setAnalysisData(pollData.data);
              } else if (pollData.status === 'queued') {
                setTimeout(poll, 2000);
              }
            } catch (err) {
              // silent fail for background refresh
            }
          };
          setTimeout(poll, 2000);
        }
      } else if (data.status === 'queued') {
        const cacheKey = data.cacheKey;
        let attempts = 0;
        
        const poll = async () => {
          try {
            const queryParams = new URLSearchParams({
              cacheKey,
              platform,
              input,
              maxGames: maxGames.toString()
            }).toString();
            const pollRes = await fetch(`${apiUrl}?${queryParams}`, { headers });
            const pollData = await pollRes.json();
            
            if (pollData.status === 'ready') {
              setAnalysisData(pollData.data);
              setIsLoading(false);
            } else if (pollData.status === 'failed') {
              setError(pollData.error || 'Analysis failed during processing.');
              setIsLoading(false);
            } else {
              attempts++;
              if (attempts > 60) {
                setError('Analysis timed out. Please try again later.');
                setIsLoading(false);
              } else {
                setTimeout(poll, 2000);
              }
            }
          } catch (err) {
            setError('Failed to check status.');
            setIsLoading(false);
          }
        };
        
        setTimeout(poll, 2000);
      }
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleAnalyze} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('platform')}</label>
          <select 
            value={platform} 
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full border-slate-200 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 border"
          >
            <option value="lichess">Lichess</option>
            <option value="chesscom">Chess.com</option>
          </select>
        </div>
        <div className="flex-[2] w-full">
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('username_or_url')}</label>
          <input 
            type="text" 
            required
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full border-slate-200 rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 border"
          />
        </div>
        <button 
          type="submit" 
          className="w-full md:w-auto bg-indigo-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
        >
          {t('analyze')}
        </button>
      </div>
      <div className="w-full pt-2">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-slate-700">
            {t('max_games')} ({maxGames})
          </label>
          {tier === 'free' && <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">{t('pro_limit')}</span>}
        </div>
        <input 
          type="range" 
          min="10" 
          max={maxAllowed} 
          step="10"
          value={maxGames}
          onChange={(e) => setMaxGames(Number(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>10</span>
          <span>{maxAllowed}</span>
        </div>
      </div>
    </form>
  );
}
