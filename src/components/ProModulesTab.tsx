import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store';
import { AlertCircle } from 'lucide-react';
import { BoardViewer } from './BoardViewer';
import { ProGate } from './ProGate';
import { MatchupPackTab } from './MatchupPackTab';

const EmptyState = ({ title, reason }: { title: string, reason: string }) => {
  const { t } = useTranslation();
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full">
      <h3 className="text-lg font-bold text-slate-800 mb-4">{t(title)}</h3>
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-xl border border-slate-100">
        <AlertCircle className="w-8 h-8 text-slate-400 mb-3" />
        <p className="text-slate-700 font-medium mb-2">{t('insufficient_data')}</p>
        <p className="text-sm text-slate-500">{reason}</p>
      </div>
    </div>
  );
};

export function ProModulesTab() {
  const { t } = useTranslation();
  const { analysisData } = useStore();

  const proModules = analysisData?.proModules || {};

  const renderModule = (key: string, titleKey: string) => {
    const moduleData = proModules[key];
    
    if (!moduleData || moduleData.error) {
      return <EmptyState title={titleKey} reason={moduleData?.error || 'Data unavailable'} />;
    }

    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full">
        <h3 className="text-lg font-bold text-slate-800 mb-4">{t(titleKey)}</h3>
        {moduleData.examples ? (
          <div className="flex-1">
            <BoardViewer examples={moduleData.examples} compact={true} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100 text-slate-500">
            Data available but no examples provided.
          </div>
        )}
      </div>
    );
  };

  return (
    <ProGate requiredTier="pro">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {renderModule('trendShift', 'trend_shift')}
        {renderModule('pressureMap', 'pressure_map')}
        {renderModule('antiPrep', 'anti_prep')}
        <MatchupPackTab />
      </div>
    </ProGate>
  );
}
