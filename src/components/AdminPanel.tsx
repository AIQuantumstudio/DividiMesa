import React from 'react';
import { Lock, Zap, Trash2, Plus, Key, UtensilsCrossed, X, Minus } from 'lucide-react';
import { Item, Preset, ItemMode } from '../types';
import { money } from '../utils/format';

interface AdminPanelProps {
  restaurantName: string;
  collectorAlias: string;
  items: Item[];
  presets: Preset[];
  onUpdateRestaurantName: (name: string) => void;
  onUpdateCollectorAlias: (alias: string) => void;
  onLockAdmin: () => void;
  onOpenImport: () => void;
  onOpenAddItem: () => void;
  onClearItems: () => void;
  onUpdateItem: (id: number, field: keyof Item, value: string | number) => void;
  onDeleteItem: (id: number) => void;
  onLoadPreset: (key: string) => void;
  onSaveCurrentPreset: () => void;
  onDeletePreset: (index: number) => void;
  onChangePin: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  restaurantName,
  collectorAlias,
  items,
  presets,
  onUpdateRestaurantName,
  onUpdateCollectorAlias,
  onLockAdmin,
  onOpenImport,
  onOpenAddItem,
  onClearItems,
  onUpdateItem,
  onDeleteItem,
  onLoadPreset,
  onSaveCurrentPreset,
  onDeletePreset,
  onChangePin
}) => {
  return (
    <div className="space-y-4">
      <div className="glass-panel p-4 rounded-2xl border border-amber-500/30 space-y-4 shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-extrabold text-amber-400 flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-amber-400" />
              <span>Panel del Restaurante</span>
            </h2>
            <p className="text-xs text-slate-400">Configurá la mesa, los pedidos y las cartas</p>
          </div>
          <button
            type="button"
            onClick={onLockAdmin}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Bloquear</span>
          </button>
        </div>

        {/* Inputs Name and Alias */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Restaurante / Mesa</label>
            <input
              type="text"
              value={restaurantName}
              onChange={e => onUpdateRestaurantName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-500 transition-all"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Alias MP / CBU de cobro</label>
            <input
              type="text"
              value={collectorAlias}
              onChange={e => onUpdateCollectorAlias(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Quick import banner */}
        <div className="bg-slate-900/90 rounded-2xl p-3 border border-amber-500/30 space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-extrabold text-amber-400 uppercase flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Carga rápida de carta</span>
              </h3>
              <p className="text-[11px] text-slate-400">Pegá tu menú: un plato por línea</p>
            </div>
            <button
              type="button"
              onClick={onOpenImport}
              className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1.5 rounded-xl active:scale-95 transition-all shadow-md cursor-pointer"
            >
              ⚡ Importar
            </button>
          </div>
        </div>

        {/* Ticket Items Editor */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold uppercase text-slate-200">
                Pedidos en la mesa (Ticket)
              </h3>
              <p className="text-[11px] text-slate-400">
                Solo vos como dueño o encargado definís los platos y cantidades servidas
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClearItems}
                className="text-xs bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 px-2.5 py-1 rounded-lg border border-rose-500/30 font-bold active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3 text-rose-400" />
                <span>Vaciar</span>
              </button>
              <button
                type="button"
                onClick={onOpenAddItem}
                className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer shadow-md flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Nuevo ítem</span>
              </button>
            </div>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {items.length === 0 ? (
              <div className="text-center py-6 bg-slate-900/50 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-400 font-bold">No hay ítems en el ticket</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tocá "+ Nuevo ítem" o "⚡ Importar" para cargar los platos pedidos
                </p>
              </div>
            ) : (
              items.map(it => (
                <div
                  key={it.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2.5"
                >
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={it.name}
                      placeholder="Nombre del plato"
                      onChange={e => onUpdateItem(it.id, 'name', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white font-bold focus:outline-none focus:border-amber-400"
                    />

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Price */}
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-bold">Precio $</span>
                        <input
                          type="number"
                          value={it.price}
                          onChange={e => onUpdateItem(it.id, 'price', parseFloat(e.target.value) || 0)}
                          className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-emerald-400 font-bold focus:outline-none"
                        />
                      </div>

                      {/* Pedidos en la mesa (Quantity controls) */}
                      <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-700/80">
                        <span className="text-[11px] text-amber-300 font-bold">Pedidos en mesa:</span>
                        <button
                          type="button"
                          onClick={() => onUpdateItem(it.id, 'qty', Math.max(1, it.qty - 1))}
                          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-black flex items-center justify-center cursor-pointer active:scale-95"
                          title="Restar cantidad"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={it.qty}
                          onChange={e => onUpdateItem(it.id, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-12 bg-transparent text-center font-black text-amber-400 focus:outline-none text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => onUpdateItem(it.id, 'qty', it.qty + 1)}
                          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 font-black flex items-center justify-center cursor-pointer active:scale-95"
                          title="Sumar cantidad"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Mode */}
                      <select
                        value={it.mode}
                        onChange={e => onUpdateItem(it.id, 'mode', e.target.value as ItemMode)}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] font-bold focus:outline-none cursor-pointer"
                      >
                        <option value="units">🔢 Por unidad</option>
                        <option value="shared">🤝 Compartido</option>
                      </select>

                      <div className="text-[11px] text-slate-400 ml-auto sm:ml-0 font-medium">
                        Total ítem: <b className="text-emerald-400 font-mono">{money(it.price * it.qty)}</b>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteItem(it.id)}
                    className="self-end sm:self-center text-rose-400 hover:text-rose-300 p-2 text-sm transition-colors cursor-pointer bg-slate-800/40 hover:bg-slate-800 rounded-lg border border-transparent hover:border-rose-500/30"
                    title="Eliminar ítem"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Saved Menus / Presets */}
        <div className="space-y-2 pt-3 border-t border-slate-800">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase text-slate-300">Cartas guardadas</h3>
            <button
              type="button"
              onClick={onSaveCurrentPreset}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-lg font-bold active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Guardar actual</span>
            </button>
          </div>

          <div className="space-y-2">
            {presets.map((p, idx) => (
              <div
                key={p.key}
                className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs"
              >
                <div>
                  <h4 className="font-bold text-slate-200">{p.title}</h4>
                  <p className="text-[10px] text-slate-400">{p.items.length} ítems</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => onLoadPreset(p.key)}
                    className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg font-bold active:scale-95 transition-all cursor-pointer"
                  >
                    Cargar
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePreset(idx)}
                    className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                    title="Eliminar carta"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Change Pin Button */}
        <div className="pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onChangePin}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>Cambiar clave del restaurante</span>
          </button>
        </div>
      </div>
    </div>
  );
};
