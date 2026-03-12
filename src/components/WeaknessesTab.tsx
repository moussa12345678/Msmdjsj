import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store';
import { AlertCircle } from 'lucide-react';

export function WeaknessesTab() {
  const { t } = useTranslation();
  const { analysisData } = useStore();

  if (!analysisData || !analysisData.weaknesses) return null;

  const validWeaknesses = analysisData.weaknesses.filter((w: any) => 
    w.evidence && 
    w.evidence.percentage !== undefined && 
    w.evidence.n !== undefined && 
    w.evidence.ruleUsed
  );

  if (validWeaknesses.length === 0) {
    return (
      <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-xl border border-slate-100 w-full max-w-2xl">
          <AlertCircle className="w-8 h-8 text-slate-400 mb-3" />
          <p className="text-slate-700 font-medium mb-2">{t('insufficient_data')}</p>
          <p className="text-sm text-slate-500 mb-4">No significant weaknesses found based on the evidence.</p>
          <p className="text-xs text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100">{t('widen_search')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {validWeaknesses.map((w: any, idx: number) => (
        <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-xl font-bold text-slate-800 mb-2">
            Evidence-Based Weakness
          </h3>
          <p className="text-slate-600 mb-4">
            Opponent exhibits this pattern in {w.evidence.percentage}% of relevant games (based on {w.evidence.n} occurrences).
          </p>
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <h4 className="text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wider">{t('evidence')}</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="block text-xs text-slate-500">Percentage</span>
                <span className="font-medium text-indigo-600">{w.evidence.percentage}%</span>
              </div>
              <div>
                <span className="block text-xs text-slate-500">Sample Size (n)</span>
                <span className="font-medium">{w.evidence.n}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-500">Rule Used</span>
                <span className="font-medium text-xs font-mono bg-slate-200 px-1 py-0.5 rounded">{w.evidence.ruleUsed}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-500">{t('confidence')}</span>
                <span className={`font-medium ${w.evidence.confidence === 'High' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {w.evidence.confidence}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
