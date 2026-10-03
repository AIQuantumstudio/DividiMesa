import React from 'react';
import { Plus, Users, Utensils } from 'lucide-react';
import { Item, Diner, Preset, TableTotals, COLORS } from '../types';
import { money, fmtU, assignedUnits, partCount } from '../utils/format';

interface TicketViewProps {
  items: Item[];
  diners: Diner[];
  currentDinerId: number | null;
  presets: Preset[];
  totals: TableTotals;
  tipPercentage: number;
  onOpenAddDiner: () => void;
  onSplitAll: (id: number) => void;
  onSetItemMode: (id: number, mode: 'units' | 'shared') => void;
  onToggleShared: (itemId: number, dinerId: number) => void;
  onStepUnits: (itemId: number, delta: number) => void;
  onSetUnits: (itemId: number, value: string | number) => void;
  onLoadPreset: (key: string) => void;
}

export const TicketView: React.FC<TicketViewProps> = ({
  items,
  diners,
  currentDinerId,
  presets,
  totals,
  tipPercentage,
  onOpenAddDiner,
  onSplitAll,
  onSetItemMode,
  onToggleShared,
  onStepUnits,
  onSetUnits,
  onLoadPreset
}) => {
  const currentDiner = diners.find(d => d.id === currentDinerId);

  return (
    <div className="space-y-3">
      {/* Total del Ticket Card */}
      <div className="glass-panel p-3.5 rounded-2xl space-y-2 shadow-lg">
        <div className="flex justify-between items-baseline border-b border-slate-800 pb-2">
          <div>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
              Total del Ticket
            </span>
            <h2 className="text-2xl font-black text-white">{money(totals.grand)}</h2>
          </div>
          <div className="text-right text-xs text-slate-400 space-y-0.5">
            <div>
              Platos: <b className="text-slate-200">{money(totals.sub)}</b>
            </div>
            <div>
              Propina ({tipPercentage}%): <b className="text-slate-200">{money(totals.tip)}</b>
            </div>
            <div>
              Cubierto: <b className="text-slate-200">{money(totals.cover)}</b>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Elegí tu nombre arriba. En cada ítem poné cuántas unidades consumiste vos (ej. 4 empanadas),
          o marcá «Compartido» si se divide entre los que participan (vino, gaseosa).
        </p>
      </div>

      {/* Header Detalle */}
      <div className="flex justify-between items-center px-1">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Detalle del Ticket
        </span>
        <span className="text-[11px] text-slate-400 font-medium">
          {items.length} {items.length === 1 ? 'ítem cargado' : 'ítems cargados'}
        </span>
      </div>

      {/* Items List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {items.length === 0 ? (
          <div className="glass-panel p-6 rounded-2xl text-center space-y-3 md:col-span-2">
            <Utensils className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-400">
              No hay ítems cargados en la mesa todavía.
            </p>
            <p className="text-[11px] text-slate-500">
              El encargado o restaurante debe ingresar con la clave y cargar los pedidos de la mesa.
            </p>
          </div>
        ) : (
          items.map(it => {
            const isShared = it.mode === 'shared';
            const total = it.price * it.qty;
            const participantsCount = partCount(it);
            const myShare = currentDinerId ? it.shares[currentDinerId] || 0 : 0;
            const asg = assignedUnits(it);
            const left = Math.round((it.qty - asg) * 100) / 100;
            const hasMine = myShare > 0;

            return (
              <div
                key={it.id}
                className={`glass-panel rounded-2xl p-3.5 border space-y-2.5 transition-all ${
                  hasMine
                    ? 'border-emerald-500/60 bg-emerald-950/15 ring-1 ring-emerald-500/30'
                    : 'border-slate-800'
                }`}
              >
                {/* Header item (read-only for diners) */}
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-extrabold text-sm text-slate-100">{it.name}</h3>
                      {it.qty > 1 && (
                        <span className="bg-slate-800 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-700">
                          x{it.qty} en mesa
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-black text-emerald-400 mt-0.5">
                      {money(total)}
                      {it.qty > 1 && (
                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                          ({money(it.price)} c/u)
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSplitAll(it.id)}
                    className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-400 rounded-xl text-[11px] font-bold active:scale-95 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                    title="Repartir entre todos"
                  >
                    <Users className="w-3 h-3 text-sky-400" />
                    <span>Entre todos</span>
                  </button>
                </div>

                {/* Mode Buttons */}
                <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-900 rounded-lg border border-slate-800 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => onSetItemMode(it.id, 'units')}
                    className={`py-1.5 rounded-md transition-all cursor-pointer ${
                      !isShared ? 'bg-emerald-500 text-slate-950 font-black shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🔢 Cada uno su cantidad
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetItemMode(it.id, 'shared')}
                    className={`py-1.5 rounded-md transition-all cursor-pointer ${
                      isShared ? 'bg-sky-500 text-slate-950 font-black shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🤝 Compartido
                  </button>
                </div>

                {/* Interactive diner controls */}
                {!currentDiner ? (
                  <button
                    type="button"
                    onClick={onOpenAddDiner}
                    className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-emerald-400 transition-all cursor-pointer"
                  >
                    Registrate para sumar tu consumo
                  </button>
                ) : isShared ? (
                  <button
                    type="button"
                    onClick={() => onToggleShared(it.id, currentDiner.id)}
                    className={`w-full py-2.5 rounded-xl border text-xs font-black active:scale-95 transition-all cursor-pointer shadow-sm ${
                      hasMine
                        ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 border-sky-400 shadow-sky-500/20'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    {hasMine ? '✔ Participo (tocá para sacarme)' : '+ Yo participo de este ítem'}
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/70 rounded-xl p-2 border border-slate-800">
                    <span className="text-[11px] text-slate-300 font-semibold">
                      ¿Cuántos consumiste vos?
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onStepUnits(it.id, -1)}
                        className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-black text-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min="0"
                        value={myShare || ''}
                        placeholder="0"
                        onChange={e => onSetUnits(it.id, e.target.value)}
                        className={`w-16 h-9 text-center bg-slate-950 border rounded-lg font-black text-sm focus:outline-none transition-all ${
                          hasMine
                            ? 'border-emerald-500/60 text-emerald-400 shadow-sm shadow-emerald-500/20'
                            : 'border-slate-700 text-slate-300'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => onStepUnits(it.id, 1)}
                        className="w-9 h-9 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-sm"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetUnits(it.id, 0.5)}
                        className="h-9 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-400 text-xs font-black active:scale-95 transition-all cursor-pointer"
                        title="Media porción"
                      >
                        ½
                      </button>
                    </div>
                  </div>
                )}

                {/* Diners list & status */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-1 border-t border-slate-800/60">
                  {isShared ? (
                    diners.length > 0 ? (
                      diners.map(d => {
                        const isParticipating = !!it.shares[d.id];
                        const c = COLORS[d.color];
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => onToggleShared(it.id, d.id)}
                            className={`inline-flex items-center gap-1 rounded-full pl-0.5 pr-2 py-0.5 text-[10px] font-bold border transition-all cursor-pointer ${
                              isParticipating
                                ? 'bg-sky-500/20 border-sky-500/50 text-sky-200'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-300'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full ${c.badge} inline-flex items-center justify-center text-[9px] font-black`}
                            >
                              {d.avatar}
                            </span>
                            <span>{d.name}</span>
                            {isParticipating && <span>✔</span>}
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-slate-500">Nadie lo asignó todavía</span>
                    )
                  ) : (
                    Object.keys(it.shares).length > 0 ? (
                      Object.keys(it.shares).map(key => {
                        const d = diners.find(x => x.id === Number(key));
                        if (!d) return null;
                        const c = COLORS[d.color];
                        return (
                          <span
                            key={d.id}
                            className="inline-flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-full pl-0.5 pr-2 py-0.5 text-[10px] font-bold"
                          >
                            <span
                              className={`w-4 h-4 rounded-full ${c.badge} inline-flex items-center justify-center text-[9px] font-black`}
                            >
                              {d.avatar}
                            </span>
                            <span>
                              {d.name} · {fmtU(it.shares[d.id])}
                            </span>
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-slate-500">Nadie lo asignó todavía</span>
                    )
                  )}

                  <div className="ml-auto text-right text-[11px]">
                    {isShared ? (
                      participantsCount > 0 ? (
                        <span className="text-sky-300 font-bold">
                          Entre {participantsCount}: {money(total / participantsCount)} c/u
                        </span>
                      ) : (
                        <span className="text-amber-400 font-bold">Nadie lo marcó todavía</span>
                      )
                    ) : (
                      left > 0.001 ? (
                        <span className="text-amber-400 font-bold">
                          Faltan {fmtU(left)} de {it.qty} por asignar
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-bold">
                          ✔ {fmtU(asg)} de {it.qty} asignados
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Preset menus */}
      <div className="pt-3 border-t border-slate-800 space-y-2">
        <p className="text-xs text-slate-300 font-bold flex items-center gap-1.5">
          <Utensils className="w-3.5 h-3.5 text-emerald-400" />
          <span>Cartas digitales de ejemplo:</span>
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {presets.map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => onLoadPreset(p.key)}
              className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap active:scale-95 transition-all flex flex-col text-left cursor-pointer shrink-0"
            >
              <span className="text-emerald-400 text-[10px] font-black">{p.title}</span>
              <span className="text-[10px] text-slate-400">{p.items.length} ítems</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
