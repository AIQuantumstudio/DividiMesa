import React, { useState, useEffect, useRef } from 'react';
import { X, UserPlus } from 'lucide-react';

interface AddDinerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}

export const AddDinerModal: React.FC<AddDinerModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl border border-slate-700/60">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>Registrar comensal</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs">
          <label className="block text-slate-400 font-semibold mb-1">Nombre o apodo</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            placeholder="Ej: Mateo, Sofía..."
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
          />
        </div>

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
            onClick={handleSave}
            className="w-1/2 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md"
          >
            Registrarme
          </button>
        </div>
      </div>
    </div>
  );
};
