import React, { useState, useEffect, useRef } from 'react';

export interface AskModalState {
  isOpen: boolean;
  type: 'confirm' | 'text';
  title: string;
  msg?: string;
  defaultValue?: string;
  onConfirm: (val?: string) => void;
}

interface AskModalProps {
  state: AskModalState;
  onClose: () => void;
}

export const AskModal: React.FC<AskModalProps> = ({ state, onClose }) => {
  const [val, setVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.isOpen) {
      setVal(state.defaultValue || '');
      if (state.type === 'text') {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [state.isOpen, state.defaultValue, state.type]);

  if (!state.isOpen) return null;

  const handleOk = () => {
    state.onConfirm(state.type === 'text' ? val : undefined);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleOk();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[65] flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl border border-slate-700/60">
        <h3 className="font-bold text-sm text-slate-100">{state.title}</h3>
        {state.msg && <p className="text-xs text-slate-300 leading-relaxed">{state.msg}</p>}

        {state.type === 'text' && (
          <input
            ref={inputRef}
            type="text"
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
          />
        )}

        <div className="flex space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleOk}
            className="w-1/2 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
};
