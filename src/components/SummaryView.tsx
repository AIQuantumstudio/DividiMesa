import React from 'react';
import { Users, UserCheck, Crown, HandCoins, Wallet, Copy, Share2 } from 'lucide-react';
import { Diner, Item, TableTotals, DinerTotals, PaymentMode, COLORS } from '../types';
import { money, fmtU, partCount } from '../utils/format';

interface SummaryViewProps {
  paymentMode: PaymentMode;
  singlePayerId: number | null;
  diners: Diner[];
  items: Item[];
  tableTotals: TableTotals;
  dinerTotalsMap: Record<number, DinerTotals>;
  tipPercentage: number;
  coverCharge: number;
  collectorAlias: string;
  onSetPaymentMode: (mode: PaymentMode) => void;
  onSetSinglePayer: (id: number) => void;
  onSetPayerAlias: (alias: string) => void;
  onSetTip: (tip: number) => void;
  onSetCoverCharge: (charge: number) => void;
  onDistributeUnassigned: () => void;
  onTogglePaid: (dinerId: number) => void;
  onCopyAlias: () => void;
  onShareWhatsApp: () => void;
}

export const SummaryView: React.FC<SummaryViewProps> = ({
  paymentMode,
  singlePayerId,
  diners,
  items,
  tableTotals,
  dinerTotalsMap,
  tipPercentage,
  coverCharge,
  collectorAlias,
  onSetPaymentMode,
  onSetSinglePayer,
  onSetPayerAlias,
  onSetTip,
  onSetCoverCharge,
  onDistributeUnassigned,
  onTogglePaid,
  onCopyAlias,
  onShareWhatsApp
}) => {
  const isSingle = paymentMode === 'single';
  const singlePayer = diners.find(d => d.id === singlePayerId) || null;

  // Total consumed by all diners registered
  const mesaTotals = diners.reduce(
    (acc, d) => {
      const dt = dinerTotalsMap[d.id] || { sub: 0, tip: 0, cover: 0, grand: 0 };
      acc.sub += dt.sub;
      acc.tip += dt.tip;
      acc.cover += dt.cover;
      acc.grand += dt.grand;
      return acc;
    },
    { sub: 0, tip: 0, cover: 0, grand: 0 }
  );

  const payTotal = isSingle ? mesaTotals.grand : tableTotals.grand;
  const gap = Math.round(tableTotals.grand - mesaTotals.grand);

  let collected = 0;
  let paidCount = 0;
  diners.forEach(d => {
    if ((isSingle && d.id === singlePayer?.id) || d.paid) {
      collected += dinerTotalsMap[d.id]?.grand || 0;
      paidCount++;
    }
  });

  const progressPercent = payTotal > 0 ? Math.min(100, Math.round((collected / payTotal) * 100)) : 0;
  const othersTotal = isSingle && singlePayer
    ? diners.filter(d => d.id !== singlePayer.id).reduce((sum, d) => sum + (dinerTotalsMap[d.id]?.grand || 0), 0)
    : 0;

  const currentActiveAlias = isSingle && singlePayer?.alias ? singlePayer.alias : collectorAlias;

  // Sort single payer to top if present
  const sortedDiners = [...diners].sort((a, b) => {
    if (isSingle && singlePayer) {
      if (a.id === singlePayer.id) return -1;
      if (b.id === singlePayer.id) return 1;
    }
    return 0;
  });

  return (
    <div className="space-y-4">
      {/* Modalidad de Pago */}
      <div className="glass-panel p-4 rounded-2xl space-y-3 shadow-lg">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Modalidad de Pago
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onSetPaymentMode('individual')}
            className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
              !isSingle
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Cada uno paga lo suyo</span>
          </button>
          <button
            type="button"
            onClick={() => onSetPaymentMode('single')}
            className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
              isSingle
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Uno solo paga al lugar</span>
          </button>
        </div>

        {isSingle && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 space-y-2.5">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>¿Quién abona la cuenta completa?</span>
            </span>

            <select
              value={singlePayerId || ''}
              onChange={e => onSetSinglePayer(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-amber-400 focus:outline-none cursor-pointer"
            >
              {diners.length === 0 ? (
                <option value="">-- Sin comensales --</option>
              ) : (
                diners.map(d => (
                  <option key={d.id} value={d.id}>
                    👑 {d.name}
                  </option>
                ))
              )}
            </select>

            <div>
              <label className="block text-[11px] text-amber-200 font-semibold mb-1">
                Alias / CBU del pagador (donde le transfieren)
              </label>
              <input
                type="text"
                value={singlePayer?.alias || ''}
                placeholder="ej: juan.mp"
                onChange={e => onSetPayerAlias(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              💡 <b className="text-amber-400">{singlePayer?.name || 'El pagador'}</b> paga todo al restaurante ({money(payTotal)}). Abajo ves lo que le debe transferir cada uno.
            </p>
          </div>
        )}
      </div>

      {/* Propina & Cubierto */}
      <div className="glass-panel p-4 rounded-2xl space-y-3 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              <HandCoins className="w-4 h-4 text-emerald-400" />
              <span>Propina proporcional</span>
            </h3>
            <p className="text-[11px] text-slate-400">Cada uno paga propina sobre lo suyo</p>
          </div>
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1">
            <input
              type="number"
              min="0"
              max="100"
              value={tipPercentage}
              onChange={e => {
                const val = parseFloat(e.target.value);
                onSetTip(isNaN(val) || val < 0 ? 0 : val);
              }}
              className="w-10 bg-transparent text-emerald-400 font-black text-right text-base focus:outline-none"
            />
            <span className="text-emerald-400 font-black">%</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[0, 3, 5, 10].map(pct => {
            const isActive = tipPercentage === pct;
            return (
              <button
                key={pct}
                type="button"
                onClick={() => onSetTip(pct)}
                className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-black shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                }`}
              >
                {pct}%
              </button>
            );
          })}
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-xs">
          <span className="text-slate-300">Cubierto por comensal:</span>
          <div className="flex items-center space-x-1">
            <span className="text-slate-400">$</span>
            <input
              type="number"
              value={coverCharge}
              onChange={e => onSetCoverCharge(parseFloat(e.target.value) || 0)}
              className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Recaudación Card */}
      <div className="glass-panel p-4 rounded-2xl space-y-2 shadow-lg">
        <div className="flex justify-between items-baseline">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Recaudación
          </span>
          <div>
            <span className="text-emerald-400 font-black text-lg">{money(collected)}</span>
            <span className="text-slate-400 text-xs"> / {money(payTotal)}</span>
          </div>
        </div>
        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-teal-400 to-emerald-400 h-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-2 justify-between text-[11px] text-slate-400 pt-1 items-center">
          {tableTotals.un > 0 ? (
            <span className="text-amber-400 font-bold">
              ⚠ {tableTotals.un} ítem(s) sin asignar {gap > 1 ? `(${money(gap)})` : ''} ·{' '}
              <button
                type="button"
                onClick={onDistributeUnassigned}
                className="underline font-black text-amber-300 hover:text-amber-200 cursor-pointer"
              >
                Repartir entre todos
              </button>
            </span>
          ) : (
            <span className="text-emerald-400 font-medium">Todos los ítems asignados</span>
          )}
          <span className="font-semibold text-slate-300">
            {paidCount} de {diners.length} {paidCount === 1 ? 'saldó' : 'saldaron'}
          </span>
        </div>
      </div>

      {/* Desglose individual */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Desglose individual
          </span>
          <button
            type="button"
            onClick={onShareWhatsApp}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Compartir WhatsApp</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedDiners.length === 0 ? (
            <div className="glass-panel p-6 rounded-2xl text-center text-xs text-slate-400 md:col-span-2">
              No hay comensales registrados todavía.
            </div>
          ) : (
            sortedDiners.map(d => {
              const x = dinerTotalsMap[d.id] || { sub: 0, tip: 0, cover: 0, grand: 0 };
              const color = COLORS[d.color];
              const isPayer = isSingle && d.id === singlePayer?.id;
              const pct = tableTotals.grand > 0 ? ((x.grand / tableTotals.grand) * 100).toFixed(1) : '0.0';

              const lines = isPayer
                ? items
                    .filter(i => partCount(i) > 0)
                    .map(i => `${i.name} ×${fmtU(i.mode === 'shared' ? i.qty : Object.values(i.shares).reduce((a, b) => a + b, 0))}`)
                    .join(' · ')
                : items
                    .filter(i => i.shares[d.id])
                    .map(i =>
                      i.mode === 'shared'
                        ? `${i.name} (÷${partCount(i)})`
                        : `${i.name} ×${fmtU(i.shares[d.id])}`
                    )
                    .join(' · ');

              const subText = isPayer ? (
                <>
                  Paga todo lo que consumió la mesa:{' '}
                  <b className="text-amber-400 font-mono">{money(mesaTotals.grand)}</b> · su parte{' '}
                  {money(x.grand)} · los demás le transfieren {money(othersTotal)}
                  {gap > 1 && (
                    <span className="text-amber-400 font-semibold ml-1">
                      · sin asignar: {money(gap)}
                    </span>
                  )}
                </>
              ) : isSingle && singlePayer ? (
                <>
                  Le transfiere a {singlePayer.name}:{' '}
                  <b className="text-emerald-400 font-mono">{money(x.grand)}</b> ({pct}%)
                </>
              ) : (
                <>
                  Debe transferir: <b className="text-emerald-400 font-mono">{money(x.grand)}</b> ({pct}%)
                </>
              );

              const badgeText = isPayer ? 'PAGA TODO AL LOCAL' : d.paid ? 'PAGADO' : 'PENDIENTE';
              const displayTotals = isPayer ? mesaTotals : x;

              return (
                <div
                  key={d.id}
                  className={`glass-panel rounded-2xl p-4 border space-y-2.5 transition-all shadow-md ${
                    isPayer
                      ? 'border-amber-500/60 bg-amber-950/20 md:col-span-2'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 shrink-0 rounded-full ${color.badge} flex items-center justify-center font-black text-xs shadow-sm`}
                      >
                        {d.avatar}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm truncate flex items-center gap-1 text-slate-100">
                          <span>{d.name}</span>
                          {isPayer && <span className="text-amber-400">👑</span>}
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-tight">{subText}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-base font-black ${
                          isPayer ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {money(isPayer ? mesaTotals.grand : x.grand)}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isPayer
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            : d.paid
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {badgeText}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300 truncate">
                    {isPayer ? '🧾 Toda la mesa:' : '🍽️'}{' '}
                    {lines || <span className="text-slate-500">Todavía no marcó nada</span>}
                  </p>

                  <div className="bg-slate-900/60 rounded-xl p-2.5 text-[11px] space-y-1 font-mono border border-slate-800/80">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Platos & bebidas:</span>
                      <span className="text-slate-200">{money(displayTotals.sub)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Propina ({tipPercentage}%):</span>
                      <span className="text-slate-200">{money(displayTotals.tip)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Cubierto:</span>
                      <span className="text-slate-200">{money(displayTotals.cover)}</span>
                    </div>
                  </div>

                  {!isPayer && (
                    <div className="flex justify-end pt-1 border-t border-slate-800/60">
                      <button
                        type="button"
                        onClick={() => onTogglePaid(d.id)}
                        className={`text-xs px-3 py-2 rounded-lg border font-bold active:scale-95 transition-all cursor-pointer ${
                          d.paid
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                            : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {d.paid ? 'Marcar pendiente' : 'Marcar como pagado'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Cuenta de transferencia */}
      <div className="glass-panel p-4 rounded-2xl space-y-3 shadow-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-100">Cuenta de transferencia</h4>
              <p className="text-[11px] text-slate-400">
                {isSingle && singlePayer
                  ? `Transferir a: ${singlePayer.name} (pagó la cuenta en el local)`
                  : 'Cobrador: encargado de mesa / restaurante'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 flex justify-between items-center">
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold">
              {isSingle && singlePayer ? `Alias de ${singlePayer.name}` : 'Alias Mercado Pago / CBU'}
            </p>
            <p className="text-sm font-mono font-bold text-emerald-400">
              {currentActiveAlias || (isSingle && singlePayer ? `Falta cargar el alias de ${singlePayer.name}` : 'Sin alias configurado')}
            </p>
          </div>
          <button
            type="button"
            onClick={onCopyAlias}
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-3 py-1.5 rounded-lg font-bold active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copiar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
