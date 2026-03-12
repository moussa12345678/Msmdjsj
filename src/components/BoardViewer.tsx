import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store';

export function BoardViewer({ examples, compact = false }: { examples?: { pgn: string, reason: string }[], compact?: boolean }) {
  const { t } = useTranslation();
  const { analysisData } = useStore();
  const dataToUse = examples || analysisData?.examples;
  const [game, setGame] = useState(new Chess());
  const [currentExampleIdx, setCurrentExampleIdx] = useState(0);
  const [moveIndex, setMoveIndex] = useState(0);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (dataToUse && dataToUse.length > 0) {
      const pgn = dataToUse[currentExampleIdx].pgn;
      const newGame = new Chess();
      try {
        newGame.loadPgn(pgn);
        setHistory(newGame.history({ verbose: true }));
        
        // Reset to start
        const resetGame = new Chess();
        setGame(resetGame);
        setMoveIndex(0);
      } catch (e) {
        console.error("Error loading PGN", e);
      }
    }
  }, [dataToUse, currentExampleIdx]);

  if (!dataToUse || dataToUse.length === 0) {
    return <div className="text-center p-8 text-slate-500">No examples available.</div>;
  }

  const handleNextExample = () => {
    setCurrentExampleIdx((prev) => (prev + 1) % dataToUse.length);
  };

  const handlePrevExample = () => {
    setCurrentExampleIdx((prev) => (prev - 1 + dataToUse.length) % dataToUse.length);
  };

  const handleNextMove = () => {
    if (moveIndex < history.length) {
      const newGame = new Chess(game.fen());
      newGame.move(history[moveIndex]);
      setGame(newGame);
      setMoveIndex(moveIndex + 1);
    }
  };

  const handlePrevMove = () => {
    if (moveIndex > 0) {
      const newGame = new Chess();
      for (let i = 0; i < moveIndex - 1; i++) {
        newGame.move(history[i]);
      }
      setGame(newGame);
      setMoveIndex(moveIndex - 1);
    }
  };

  const example = dataToUse[currentExampleIdx];

  return (
    <div className={`flex flex-col ${compact ? 'gap-4' : 'md:flex-row gap-8'}`}>
      <div className={`flex-1 mx-auto w-full ${compact ? 'max-w-[300px]' : 'max-w-[500px]'}`}>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4">
          {/* @ts-ignore */}
          <Chessboard position={game.fen()} arePiecesDraggable={false} />
        </div>
        <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <button onClick={handlePrevMove} disabled={moveIndex === 0} className="px-4 py-2 bg-white border border-slate-300 rounded-lg disabled:opacity-50">Prev</button>
          <span className="font-mono text-sm">{moveIndex} / {history.length}</span>
          <button onClick={handleNextMove} disabled={moveIndex === history.length} className="px-4 py-2 bg-white border border-slate-300 rounded-lg disabled:opacity-50">Next</button>
        </div>
      </div>

      <div className="flex-1">
        <div className={`bg-white ${compact ? 'p-4' : 'p-6'} rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col`}>
          <h3 className={`${compact ? 'text-lg' : 'text-xl'} font-bold text-slate-800 mb-4`}>Example {currentExampleIdx + 1} of {dataToUse.length}</h3>
          
          <div className={`bg-indigo-50 text-indigo-800 ${compact ? 'p-3 text-sm' : 'p-4'} rounded-xl mb-6 border border-indigo-100`}>
            <span className="font-semibold block mb-1">Reason for selection:</span>
            {example.reason}
          </div>

          <div className="flex gap-4 mt-auto">
            <button onClick={handlePrevExample} className={`flex-1 ${compact ? 'py-2 text-sm' : 'py-3'} bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors`}>
              Previous
            </button>
            <button onClick={handleNextExample} className={`flex-1 ${compact ? 'py-2 text-sm' : 'py-3'} bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors`}>
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
