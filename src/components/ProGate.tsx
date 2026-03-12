import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store';
import { Lock } from 'lucide-react';

export function ProGate({ children, requiredTier = 'pro' }: { children: React.ReactNode, requiredTier?: 'pro' | 'elite' }) {
  const { t } = useTranslation();
  const { tier } = useStore();

  const isAuthorized = requiredTier === 'elite' ? tier === 'elite' : (tier === 'pro' || tier === 'elite');

  if (!isAuthorized) {
    return (
      <div className="relative bg-white p-12 rounded-2xl shadow-sm border border-slate-100 overflow-hidden text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-white/50 to-slate-100/90 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center">
          <div className="bg-white p-4 rounded-full shadow-lg mb-6 border border-slate-100">
            <Lock className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Pro Modules Locked</h2>
          <p className="text-slate-600 max-w-md mx-auto mb-8">
            Upgrade to {requiredTier === 'elite' ? 'Elite' : 'Pro or Elite'} to unlock this feature.
          </p>
          <button className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg transform hover:-translate-y-0.5 duration-200">
            {t('upgrade_pro')}
          </button>
        </div>

        {/* Blurred background content */}
        <div className="opacity-30 pointer-events-none select-none blur-sm">
          <div className="grid grid-cols-2 gap-8">
            <div className="h-48 bg-slate-200 rounded-xl"></div>
            <div className="h-48 bg-slate-200 rounded-xl"></div>
            <div className="h-48 bg-slate-200 rounded-xl"></div>
            <div className="h-48 bg-slate-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
