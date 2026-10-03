import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ItemMode } from '../../types';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, price: number, qty: number, mode: ItemMode) => void;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [mode, setMode] = useState<ItemMode>('units');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setPrice('');
      setQty('1');
      setMode('units');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmedName = name.trim();
    const parsedPrice = parseFloat(price);
    const parsedQty = parseInt(qty) || 1;

    if (!trimmedName || isNaN(parsedPrice) || parsedPrice <= 0) {
      return;
    }

    onSave(trimmedName, parsedPrice, parsedQty, mode);
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
          <h3 className="font-bold text-sm text-slate-100">Añadir ítem</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Plato o bebida</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              placeholder="Ej: Milanesa Napolitana"
              onChange={e => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Precio ($)</label>
              <input
                type="number"
                value={price}
                placeholder="4500"
                onChange={e => setPrice(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Cantidad</label>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={e => setQty(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-center font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">¿Cómo se divide?</label>
            <select
              value={mode}
              onChange={e => setMode(e.target.value as ItemMode)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="units">Cada uno pone su cantidad (empanadas, bebidas)</option>
              <option value="shared">Compartido entre los que participan (vino, gaseosa)</option>
            </select>
          </div>
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
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};
