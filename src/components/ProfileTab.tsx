import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export function ProfileTab() {
  const { t } = useTranslation();
  const { analysisData } = useStore();

  if (!analysisData || !analysisData.profile) return null;

  const { profile } = analysisData;
  const { metrics } = profile;

  const phaseData = [
    { name: 'Opening (≤15)', value: metrics.phaseLossDistribution.opening },
    { name: 'Middlegame (16-40)', value: metrics.phaseLossDistribution.mid },
    { name: 'Endgame (>40)', value: metrics.phaseLossDistribution.end },
  ];
  const COLORS = ['#6366f1', '#8b5cf6', '#d946ef'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">{t('overview')}</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-slate-500">{t('total_games')}</span>
            <span className="font-medium">{profile.totalGames}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t('wins')}</span>
            <span className="font-medium text-emerald-600">{profile.wins}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t('losses')}</span>
            <span className="font-medium text-red-600">{profile.losses}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t('draws')}</span>
            <span className="font-medium text-slate-600">{profile.draws}</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Metrics</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-slate-500">{t('fast_collapse')}</span>
            <span className="font-medium">{metrics.fastCollapseRate !== null ? `${metrics.fastCollapseRate}%` : t('no_data')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t('avg_moves_win')}</span>
            <span className="font-medium">{metrics.avgMovesWin !== null ? metrics.avgMovesWin : t('no_data')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t('avg_moves_loss')}</span>
            <span className="font-medium">{metrics.avgMovesLoss !== null ? metrics.avgMovesLoss : t('no_data')}</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Phase Loss Distribution</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={phaseData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {phaseData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-2 text-xs text-slate-500">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Opening</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-violet-500"></div> Mid</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-fuchsia-500"></div> End</div>
        </div>
      </div>
    </div>
  );
}
