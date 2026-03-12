import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './i18n';
import { useStore } from './store';
import { InputForm } from './components/InputForm';
import { ProfileTab } from './components/ProfileTab';
import { WeaknessesTab } from './components/WeaknessesTab';
import { GamePlanTab } from './components/GamePlanTab';
import { BoardViewer } from './components/BoardViewer';
import { ProModulesTab } from './components/ProModulesTab';
import { Loader2, AlertCircle, Shield, ShieldAlert, ShieldCheck, Lock, PlayCircle, ArrowUpCircle, Clock } from 'lucide-react';

export default function App() {
  const { t, i18n } = useTranslation();
  const { analysisData, isLoading, error, tier, setTier } = useStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [countdown, setCountdown] = useState<number | null>(null);

  const tabs = [
    { id: 'overview', label: t('overview') },
    { id: 'weaknesses', label: t('weaknesses') },
    { id: 'game_plan', label: t('game_plan') },
    { id: 'board', label: t('board') },
    { id: 'pro_modules', label: t('pro_modules') },
  ];

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  };

  const handleTierOverride = (newTier: string) => {
    setTier(newTier);
    localStorage.setItem('internal_tier', newTier);
    // In a real app, you'd prompt for the secret. Here we just set it for testing.
    localStorage.setItem('internal_secret', 'test_secret_123'); // Assuming this matches INTERNAL_TIER_SECRET
  };

  let parsedError: any = null;
  if (error) {
    try {
      parsedError = JSON.parse(error);
    } catch (e) {
      parsedError = { reason: 'unknown', message: error };
    }
  }

  useEffect(() => {
    if (parsedError?.retryAfterSeconds) {
      setCountdown(parsedError.retryAfterSeconds);
    } else {
      setCountdown(null);
    }
  }, [error]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [countdown]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl leading-none">O</span>
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">{t('app_title')}</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <select 
              onChange={(e) => handleLanguageChange(e.target.value)}
              value={i18n.language}
              className="text-sm border-slate-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
              <option value="fr">Français</option>
            </select>

            <div className="hidden md:flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-amber-200 relative group">
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Internal Testing Only
              </span>
              <button 
                onClick={() => handleTierOverride('free')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${tier === 'free' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Free
              </button>
              <button 
                onClick={() => handleTierOverride('pro')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${tier === 'pro' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Pro
              </button>
              <button 
                onClick={() => handleTierOverride('elite')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${tier === 'elite' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Elite
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <InputForm />
        </div>

        {parsedError && (
          <div className="mb-8 bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm">
            <div className="flex-shrink-0 bg-red-100 p-3 rounded-full">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-red-800 mb-1">
                {parsedError.reason === 'daily_limit' && 'Daily Limit Reached'}
                {parsedError.reason === 'burst_lock' && 'Too Many Requests'}
                {parsedError.reason === 'unknown' && 'Analysis Error'}
              </h3>
              <p className="text-red-700 font-medium">{parsedError.message}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-4 sm:mt-0">
              {parsedError.reason === 'daily_limit' && (
                <button className="flex items-center justify-center gap-2 bg-white hover:bg-red-50 text-red-700 border border-red-200 px-6 py-2.5 rounded-xl font-semibold transition-colors shadow-sm">
                  <ArrowUpCircle className="w-5 h-5" />
                  {t('upgrade_now')}
                </button>
              )}
              {parsedError.reason === 'burst_lock' && countdown !== null && (
                <div className="flex items-center justify-center gap-2 bg-red-100 text-red-800 px-6 py-2.5 rounded-xl font-semibold border border-red-200">
                  <Clock className="w-5 h-5" />
                  {t('retry_in')} {countdown}s
                </div>
              )}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
            <p className="text-slate-600 font-medium animate-pulse">{t('analyzing')}</p>
          </div>
        )}

        {analysisData && !isLoading && (
          <div className="space-y-8">
            <div className="flex overflow-x-auto pb-2 border-b border-slate-200 scrollbar-hide">
              <div className="flex gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-5 py-2.5 text-sm font-medium rounded-t-xl transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-white text-indigo-600 border-t border-l border-r border-slate-200 shadow-[0_4px_0_0_white] relative z-10'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                    {tab.id === 'pro_modules' && tier === 'free' && (
                      <Lock className="w-3 h-3 inline-block ml-2 mb-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-[400px]">
              {activeTab === 'overview' && <ProfileTab />}
              {activeTab === 'weaknesses' && <WeaknessesTab />}
              {activeTab === 'game_plan' && <GamePlanTab />}
              {activeTab === 'board' && <BoardViewer />}
              {activeTab === 'pro_modules' && <ProModulesTab />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
