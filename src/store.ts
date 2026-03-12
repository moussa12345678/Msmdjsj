import { create } from 'zustand';

interface AppState {
  analysisData: any | null;
  isLoading: boolean;
  error: string | null;
  tier: string;
  setAnalysisData: (data: any) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTier: (tier: string) => void;
}

export const useStore = create<AppState>((set) => ({
  analysisData: null,
  isLoading: false,
  error: null,
  tier: 'free',
  setAnalysisData: (data) => set({ analysisData: data }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setTier: (tier) => set({ tier }),
}));
