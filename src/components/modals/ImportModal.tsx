import React, { useState, useEffect, useRef } from 'react';
import { X, Zap } from 'lucide-react';
import { Item } from '../../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: Item[]) => void;
  onToast: (msg: string) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  onToast
}) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setText('');
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleProcess = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      onToast('Ingresá al menos un ítem');
      return;
    }

    const items: Item[] = [];
    const lines = trimmed.split('\n');

    lines.forEach((line, i) => {
      const lineStr = line.trim();
      if (!lineStr) return;

      const idx = lineStr.lastIndexOf(',');
      const name = (idx > -1 ? lineStr.slice(0, idx) : lineStr).trim() || `Ítem ${i + 1}`;
      let price = idx > -1 ? parseFloat(lineStr.slice(idx + 1).replace(/[^0-9.]/g, '')) : 0;
      if (isNaN(price)) price = 0;

      items.push({
        id: Date.now() + i,
        name,
        price,
        qty: 1,
        mode: 'units',
        shares: {}
      });
    });

    if (items.length === 0) {
      onToast('No se pudieron leer ítems válidos');
      return;
    }

    onImport(items);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl border border-slate-700/60">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Carga rápida</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300">
          Formato: <span className="text-amber-400 font-mono">Plato, Precio</span> por línea
        </p>

        <textarea
          ref={textareaRef}
          rows={6}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={`Milanesa con Fritas, 9500\nEmpanada de Carne, 1800\nFlan Casero, 3200`}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs font-mono text-emerald-400 focus:outline-none focus:border-amber-500"
        />

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
            onClick={handleProcess}
            className="w-1/2 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md"
          >
            Cargar
          </button>
        </div>
      </div>
    </div>
  );
};
