import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store';
import { AlertCircle } from 'lucide-react';

export function GamePlanTab() {
  const { t } = useTranslation();
  const { analysisData } = useStore();

  if (!analysisData || !analysisData.plans) return null;

  const { plans } = analysisData;

  const validWhitePlans = plans.asWhite?.filter((p: any) => p.evidence && p.evidence.percentage !== undefined && p.evidence.n !== undefined) || [];
  const validBlackPlans = plans.asBlack?.filter((p: any) => p.evidence && p.evidence.percentage !== undefined && p.evidence.n !== undefined) || [];

  if (validWhitePlans.length === 0 && validBlackPlans.length === 0) {
    return (
      <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-xl border border-slate-100 w-full max-w-2xl">
          <AlertCircle className="w-8 h-8 text-slate-400 mb-3" />
          <p className="text-slate-700 font-medium mb-2">{t('insufficient_data')}</p>
          <p className="text-sm text-slate-500 mb-4">Insufficient evidence to generate a reliable game plan.</p>
          <p className="text-xs text-indigo-700 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100">{t('widen_search')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-slate-200 border border-slate-400"></div>
          {t('as_white')}
        </h3>
        {validWhitePlans.length > 0 ? (
          <ul className="space-y-4">
            {validWhitePlans.map((plan: any, idx: number) => (
              <li key={idx} className="flex gap-4 items-start">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                  {idx + 1}
                </span>
                <div>
                  <p className="font-medium text-slate-800">{plan.point}</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Evidence: {plan.evidence.percentage}% (n={plan.evidence.n})
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500 text-sm">Insufficient evidence for a White game plan.</p>
        )}
      </div>

      <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 text-white">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-slate-800 border border-slate-600"></div>
          {t('as_black')}
        </h3>
        {validBlackPlans.length > 0 ? (
          <ul className="space-y-4">
            {validBlackPlans.map((plan: any, idx: number) => (
              <li key={idx} className="flex gap-4 items-start">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold">
                  {idx + 1}
                </span>
                <div>
                  <p className="font-medium text-slate-200">{plan.point}</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Evidence: {plan.evidence.percentage}% (n={plan.evidence.n})
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-400 text-sm">Insufficient evidence for a Black game plan.</p>
        )}
      </div>
    </div>
  );
}
