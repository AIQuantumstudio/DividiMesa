/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  ListChecks,
  Calculator
} from 'lucide-react';

import {
  Diner,
  Item,
  Preset,
  PaymentMode,
  ColorKey,
  ItemMode,
  TableTotals,
  DinerTotals,
  User,
  UserProduct
} from './types';
import { INITIAL_PRESETS } from './data/presets';
import { playTapSound } from './utils/audio';
import {
  money,
  assignedUnits,
  partCount,
  copyToClipboard,
  buildWhatsAppMessage
} from './utils/format';
import { hasConfiguredPin } from './utils/pin';
import { authService, AuthResponse } from './services/auth';

import { Header } from './components/Header';
import { TopBar } from './components/TopBar';
import { DinersBar } from './components/DinersBar';
import { TicketView } from './components/TicketView';
import { SummaryView } from './components/SummaryView';
import { AdminPanel } from './components/AdminPanel';

import { PinModal } from './components/modals/PinModal';
import { QrModal } from './components/modals/QrModal';
import { ScannerModal } from './components/modals/ScannerModal';
import { AddItemModal } from './components/modals/AddItemModal';
import { AddDinerModal } from './components/modals/AddDinerModal';
import { UserSwitchModal } from './components/modals/UserSwitchModal';
import { ImportModal } from './components/modals/ImportModal';
import { AskModal, AskModalState } from './components/modals/AskModal';
import { LoginScreen } from './components/auth/LoginScreen';
import { AccessDeniedScreen } from './components/auth/AccessDeniedScreen';
import { AdminLicenseModal } from './components/auth/AdminLicenseModal';
import { Loader2 } from 'lucide-react';

const COLOR_KEYS: ColorKey[] = ['emerald', 'sky', 'amber', 'purple', 'rose'];

export default function App() {
  // Authentication & Product Licensing State
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLicense, setAuthLicense] = useState<UserProduct | null>(null);
  const [adminLicenseModalOpen, setAdminLicenseModalOpen] = useState<boolean>(false);

  const checkAuthSession = useCallback(async () => {
    setAuthLoading(true);
    try {
      const data = await authService.getMe();
      setAuthUser(data.user);
      setAuthLicense(data.license);
    } catch {
      setAuthUser(null);
      setAuthLicense(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthSession();
  }, [checkAuthSession]);

  const handleAuthSuccess = (authData: AuthResponse) => {
    playTapSound();
    setAuthUser(authData.user);
    setAuthLicense(authData.license);
    if (authData.license.status === 'active') {
      showToast(`¡Bienvenido, ${authData.user.name}!`);
    }
  };

  const handleLogout = async () => {
    playTapSound();
    await authService.logout();
    setAuthUser(null);
    setAuthLicense(null);
    showToast('Sesión cerrada');
  };

  // App State
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [adminUnlocked, setAdminUnlocked] = useState<boolean>(false);
  const [restaurantName, setRestaurantName] = useState<string>('Don Julio Parrilla - Mesa 12');
  const [collectorAlias, setCollectorAlias] = useState<string>('dividimesa.donjulio.mp');

  const [currentDinerId, setCurrentDinerId] = useState<number | null>(null);
  const [tipPercentage, setTipPercentage] = useState<number>(10);
  const [coverCharge, setCoverCharge] = useState<number>(800);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('individual');
  const [singlePayerId, setSinglePayerId] = useState<number | null>(null);

  const [diners, setDiners] = useState<Diner[]>([]);
  const [items, setItems] = useState<Item[]>(() =>
    JSON.parse(JSON.stringify(INITIAL_PRESETS[0].items))
  );
  const [presets, setPresets] = useState<Preset[]>(() =>
    JSON.parse(JSON.stringify(INITIAL_PRESETS))
  );

  const [activeTab, setActiveTab] = useState<'items' | 'summary'>('items');

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastVisible, setToastVisible] = useState<boolean>(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    const timer = setTimeout(() => {
      setToastVisible(false);
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

  // Modal states
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<'unlock' | 'create' | 'change'>('unlock');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [addDinerModalOpen, setAddDinerModalOpen] = useState(false);
  const [userSwitchModalOpen, setUserSwitchModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const [askModalState, setAskModalState] = useState<AskModalState>({
    isOpen: false,
    type: 'confirm',
    title: '',
    onConfirm: () => {}
  });

  // Lock admin when switching browser tab or app hides
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && adminUnlocked) {
        setAdminUnlocked(false);
        setIsAdminMode(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [adminUnlocked]);

  // Current active diner object
  const currentDiner = useMemo(() => {
    return diners.find(d => d.id === currentDinerId) || null;
  }, [diners, currentDinerId]);

  // Totals calculations
  const tableTotals: TableTotals = useMemo(() => {
    let sub = 0;
    let un = 0;

    items.forEach(it => {
      sub += it.price * it.qty;
      if (it.mode === 'shared') {
        if (partCount(it) === 0) un++;
      } else {
        if (assignedUnits(it) < it.qty - 0.001) un++;
      }
    });

    const tip = Math.round((sub * tipPercentage) / 100);
    const cover = diners.length * coverCharge;

    return {
      sub,
      tip,
      cover,
      grand: sub + tip + cover,
      un
    };
  }, [items, tipPercentage, coverCharge, diners.length]);

  const dinerTotalsMap: Record<number, DinerTotals> = useMemo(() => {
    const map: Record<number, DinerTotals> = {};

    diners.forEach(d => {
      let sub = 0;
      items.forEach(it => {
        const u = it.shares[d.id];
        if (!u) return;

        if (it.mode === 'shared') {
          const count = partCount(it);
          if (count > 0) {
            sub += (it.price * it.qty) / count;
          }
        } else {
          sub += it.price * u;
        }
      });

      const tip = Math.round((sub * tipPercentage) / 100);
      const cover = coverCharge;

      map[d.id] = {
        sub: Math.round(sub),
        tip,
        cover,
        grand: Math.round(sub + tip + cover)
      };
    });

    return map;
  }, [diners, items, tipPercentage, coverCharge]);

  // --- Handlers ---
  const handleToggleSystemMode = () => {
    playTapSound();
    if (isAdminMode) {
      // Lock admin
      setAdminUnlocked(false);
      setIsAdminMode(false);
      showToast('Panel bloqueado');
      return;
    }

    if (adminUnlocked) {
      setIsAdminMode(true);
      showToast('Panel del restaurante abierto');
      return;
    }

    // Open PIN dialog
    setPinModalMode(hasConfiguredPin() ? 'unlock' : 'create');
    setPinModalOpen(true);
  };

  const handleAdminSuccess = () => {
    setAdminUnlocked(true);
    setIsAdminMode(true);
    showToast('Panel del restaurante abierto');
  };

  const handleLockAdmin = () => {
    playTapSound();
    setAdminUnlocked(false);
    setIsAdminMode(false);
    showToast('Panel bloqueado');
  };

  // Diners Management
  const handleSelectDiner = (id: number) => {
    playTapSound();
    setCurrentDinerId(id);
    const d = diners.find(x => x.id === id);
    if (d) {
      showToast(`Operando como ${d.name}`);
    }
  };

  const handleSaveDiner = (name: string) => {
    playTapSound();
    const color = COLOR_KEYS[diners.length % COLOR_KEYS.length];
    const newDiner: Diner = {
      id: Date.now(),
      name,
      color,
      avatar: name.charAt(0).toUpperCase(),
      paid: false
    };

    setDiners(prev => [...prev, newDiner]);
    setCurrentDinerId(newDiner.id);

    // If single payer is not set and payment mode is single, default to first diner
    if (!singlePayerId) {
      setSinglePayerId(newDiner.id);
    }

    showToast(`${name} registrado/a`);
  };

  const handleDeleteDiner = (id: number) => {
    playTapSound();
    setDiners(prev => prev.filter(d => d.id !== id));
    // Remove their shares from all items
    setItems(prev =>
      prev.map(it => {
        const nextShares = { ...it.shares };
        delete nextShares[id];
        return { ...it, shares: nextShares };
      })
    );

    if (currentDinerId === id) {
      const nextDiner = diners.find(d => d.id !== id);
      setCurrentDinerId(nextDiner ? nextDiner.id : null);
    }

    if (singlePayerId === id) {
      const nextDiner = diners.find(d => d.id !== id);
      setSinglePayerId(nextDiner ? nextDiner.id : null);
    }

    showToast('Comensal eliminado');
  };

  const handleResetTableSession = () => {
    playTapSound();
    setAskModalState({
      isOpen: true,
      type: 'confirm',
      title: 'Reiniciar mesa',
      msg: 'Se van a quitar todos los comensales y sus consumos.',
      onConfirm: () => {
        setDiners([]);
        setSinglePayerId(null);
        setCurrentDinerId(null);
        setItems(prev => prev.map(it => ({ ...it, shares: {} })));
        showToast('Mesa reiniciada');
      }
    });
  };

  // Items Management
  const handleTicketQtyChange = (id: number, delta: number) => {
    playTapSound();
    setItems(prev =>
      prev.map(it => {
        if (it.id !== id) return it;
        const nextQty = Math.max(1, it.qty + delta);
        const asg = assignedUnits(it);
        if (it.mode === 'units' && nextQty < asg - 1e-9) {
          showToast('Hay más unidades consumidas que ese número');
          return it;
        }
        return { ...it, qty: nextQty };
      })
    );
  };

  const handleSetItemMode = (id: number, mode: ItemMode) => {
    playTapSound();
    setItems(prev =>
      prev.map(it => {
        if (it.id !== id || it.mode === mode) return it;
        const nextShares = { ...it.shares };
        if (mode === 'shared') {
          Object.keys(nextShares).forEach(k => {
            nextShares[Number(k)] = 1;
          });
        }
        const asg = Object.values(nextShares).reduce((a, b) => a + b, 0);
        const nextQty = mode === 'units' && asg > it.qty ? Math.ceil(asg) : it.qty;
        return { ...it, mode, shares: nextShares, qty: nextQty };
      })
    );
  };

  const handleToggleShared = (itemId: number, dinerId: number) => {
    playTapSound();
    if (!dinerId) {
      setAddDinerModalOpen(true);
      return;
    }
    setItems(prev =>
      prev.map(it => {
        if (it.id !== itemId) return it;
        const nextShares = { ...it.shares };
        if (nextShares[dinerId]) {
          delete nextShares[dinerId];
        } else {
          nextShares[dinerId] = 1;
        }
        return { ...it, shares: nextShares };
      })
    );
  };

  const handleSetUnits = (itemId: number, value: string | number) => {
    if (!currentDinerId) {
      setAddDinerModalOpen(true);
      return;
    }
    const it = items.find(i => i.id === itemId);
    if (!it) return;

    let u = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    if (isNaN(u) || u < 0) u = 0;
    u = Math.round(u * 100) / 100;

    // The total orders on the table (it.qty) is strictly set by the restaurant owner.
    // Diners cannot exceed what the restaurant served for the table.
    const otherAssigned = Object.entries(it.shares)
      .filter(([dId]) => Number(dId) !== currentDinerId)
      .reduce((sum, [, val]) => sum + val, 0);

    const maxAvailable = Math.max(0, Math.round((it.qty - otherAssigned) * 100) / 100);

    if (u > maxAvailable) {
      u = maxAvailable;
      showToast(`Solo quedan ${maxAvailable} de ${it.qty} pedidos en la mesa`);
    }

    setItems(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item;
        const nextShares = { ...item.shares };
        if (u > 0) {
          nextShares[currentDinerId] = u;
        } else {
          delete nextShares[currentDinerId];
        }
        return { ...item, shares: nextShares };
      })
    );
  };

  const handleStepUnits = (itemId: number, delta: number) => {
    playTapSound();
    if (!currentDinerId) {
      setAddDinerModalOpen(true);
      return;
    }
    const it = items.find(i => i.id === itemId);
    if (!it) return;
    const current = it.shares[currentDinerId] || 0;
    handleSetUnits(itemId, current + delta);
  };

  const handleSplitAll = (itemId: number) => {
    playTapSound();
    if (diners.length === 0) {
      setAddDinerModalOpen(true);
      return;
    }
    setItems(prev =>
      prev.map(it => {
        if (it.id !== itemId) return it;
        const nextShares: Record<number, number> = {};
        if (it.mode === 'shared') {
          diners.forEach(d => {
            nextShares[d.id] = 1;
          });
        } else {
          const each = Math.round((it.qty / diners.length) * 100) / 100;
          diners.forEach(d => {
            nextShares[d.id] = each;
          });
        }
        return { ...it, shares: nextShares };
      })
    );
    showToast('Ítem repartido entre todos');
  };

  const handleDistributeUnassigned = () => {
    playTapSound();
    if (diners.length === 0) {
      setAddDinerModalOpen(true);
      return;
    }
    const n = diners.length;
    setItems(prev =>
      prev.map(it => {
        const nextShares = { ...it.shares };
        if (it.mode === 'shared') {
          if (partCount(it) === 0) {
            diners.forEach(d => {
              nextShares[d.id] = 1;
            });
          }
        } else {
          const left = it.qty - assignedUnits(it);
          if (left > 0.001) {
            const each = Math.round((left / n) * 100) / 100;
            diners.forEach(d => {
              nextShares[d.id] = Math.round(((nextShares[d.id] || 0) + each) * 100) / 100;
            });
          }
        }
        return { ...it, shares: nextShares };
      })
    );
    showToast('Lo que faltaba se repartió entre todos');
  };

  const handleSaveItem = (name: string, price: number, qty: number, mode: ItemMode) => {
    playTapSound();
    const sh: Record<number, number> =
      isAdminMode || !currentDinerId
        ? {}
        : { [currentDinerId]: mode === 'units' ? qty : 1 };

    const newItem: Item = {
      id: Date.now(),
      name,
      price,
      qty,
      mode,
      shares: sh
    };

    setItems(prev => [...prev, newItem]);
    showToast('Ítem añadido');
  };

  const handleLoadPreset = (key: string) => {
    playTapSound();
    const p = presets.find(x => x.key === key);
    if (!p) return;

    setItems(JSON.parse(JSON.stringify(p.items)).map((i: Item) => ({ ...i, shares: {} })));
    setDiners(prev => prev.map(d => ({ ...d, paid: false })));
    if (p.restaurant) {
      setRestaurantName(p.restaurant);
    }
    showToast(`Carta "${p.title}" cargada`);
  };

  const handleImportItems = (newItems: Item[]) => {
    playTapSound();
    setItems(newItems);
    showToast(`¡${newItems.length} ítems cargados!`);
  };

  // Payment & WhatsApp
  const handleTogglePaid = (dinerId: number) => {
    playTapSound();
    setDiners(prev => {
      const next = prev.map(d => {
        if (d.id === dinerId) {
          const nextPaid = !d.paid;
          showToast(`${d.name}: ${nextPaid ? 'pagado' : 'pendiente'}`);
          return { ...d, paid: nextPaid };
        }
        return d;
      });

      // Check if all diners have paid now! Trigger celebration confetti
      const allPaid = next.length > 0 && next.every(d => d.paid);
      if (allPaid) {
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch {
          // ignore confetti error
        }
      }

      return next;
    });
  };

  const handleCopyAlias = async () => {
    playTapSound();
    const singlePayer = diners.find(d => d.id === singlePayerId);
    const activeAlias =
      paymentMode === 'single' && singlePayer?.alias ? singlePayer.alias : collectorAlias;

    if (!activeAlias) {
      showToast('Cargá primero el alias del pagador');
      return;
    }
    await copyToClipboard(activeAlias);
    showToast('Alias copiado');
  };

  const handleShareWhatsApp = async () => {
    playTapSound();
    const singlePayer = diners.find(d => d.id === singlePayerId) || null;
    const msg = buildWhatsAppMessage(
      restaurantName,
      paymentMode,
      singlePayer,
      diners,
      tableTotals,
      dinerTotalsMap,
      collectorAlias
    );

    await copyToClipboard(msg);
    let opened = false;
    try {
      const w = window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      if (w) opened = true;
    } catch {
      // fallback
    }

    showToast(opened ? 'Abriendo WhatsApp…' : 'Resumen copiado: pegalo en WhatsApp');
  };

  // Admin items editing
  const handleUpdateItem = (id: number, field: keyof Item, value: string | number) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id !== id) return it;
        const next = { ...it, [field]: value };
        if (field === 'mode') {
          if (value === 'shared') {
            const nextShares = { ...next.shares };
            Object.keys(nextShares).forEach(k => {
              nextShares[Number(k)] = 1;
            });
            next.shares = nextShares;
          }
        }
        if (next.mode !== 'shared') {
          const sum = assignedUnits(next);
          if (sum > next.qty + 1e-9) {
            next.qty = Math.ceil(sum);
          }
        }
        return next;
      })
    );
  };

  const handleDeleteItem = (id: number) => {
    playTapSound();
    setItems(prev => prev.filter(i => i.id !== id));
    showToast('Ítem eliminado');
  };

  const handleClearItems = () => {
    playTapSound();
    setItems([]);
    showToast('Ticket vaciado');
  };

  const handleSaveCurrentPreset = () => {
    playTapSound();
    setAskModalState({
      isOpen: true,
      type: 'text',
      title: 'Nombre de la carta',
      defaultValue: '🌮 Noche de Tacos',
      onConfirm: title => {
        const t = (title || '').trim();
        if (!t) return;
        const newPreset: Preset = {
          key: `custom_${Date.now()}`,
          title: t,
          restaurant: restaurantName,
          items: JSON.parse(JSON.stringify(items)).map((i: Item) => ({ ...i, shares: {} }))
        };
        setPresets(prev => [...prev, newPreset]);
        showToast('Carta guardada');
      }
    });
  };

  const handleDeletePreset = (index: number) => {
    playTapSound();
    setPresets(prev => prev.filter((_, i) => i !== index));
    showToast('Carta eliminada');
  };

  // Auth & License Gates
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-emerald-500/30 selection:text-emerald-300">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 mb-3 shadow-xl shadow-emerald-500/20">
          <Loader2 className="w-7 h-7 animate-spin text-slate-950" />
        </div>
        <h2 className="text-base font-black text-white">Dividí Mesa</h2>
        <p className="text-xs text-emerald-400 font-semibold mt-0.5">Verificando autorización y licencia...</p>
      </div>
    );
  }

  if (!authUser) {
    return <LoginScreen onSuccess={handleAuthSuccess} />;
  }

  if (authLicense?.status !== 'active') {
    return (
      <AccessDeniedScreen
        user={authUser}
        license={authLicense || { id: '', user_id: authUser.id, product_id: 'prod_dividi_mesa', status: 'pending', activated_at: null }}
        onRefresh={checkAuthSession}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 antialiased">
      {/* Header */}
      <Header
        isAdminMode={isAdminMode}
        restaurantName={restaurantName}
        currentDiner={currentDiner}
        isSystemAdmin={authUser.email === 'admin@dividimesa.com' || authUser.email === 'aiquantumstudio@gmail.com'}
        onToggleMode={handleToggleSystemMode}
        onOpenUserModal={() => {
          playTapSound();
          setUserSwitchModalOpen(true);
        }}
        onOpenQr={() => {
          playTapSound();
          setQrModalOpen(true);
        }}
        onLogout={handleLogout}
        onOpenAdminLicenses={() => {
          playTapSound();
          setAdminLicenseModalOpen(true);
        }}
      />

      {/* Main Content Area */}
      <main className="max-w-md md:max-w-2xl mx-auto w-full px-4 pt-3 pb-24 flex-1 flex flex-col space-y-4">
        {/* Top Info and Quick Actions Bar */}
        <TopBar
          dinersCount={diners.length}
          onReset={handleResetTableSession}
          onOpenQr={() => {
            playTapSound();
            setQrModalOpen(true);
          }}
          onOpenScanner={() => {
            playTapSound();
            setScannerModalOpen(true);
          }}
        />

        {/* MODO COMENSAL */}
        {!isAdminMode ? (
          <div className="space-y-4">
            {/* Diners Selector Bar */}
            <DinersBar
              diners={diners}
              currentDinerId={currentDinerId}
              onSelectDiner={handleSelectDiner}
              onAddDiner={() => {
                playTapSound();
                setAddDinerModalOpen(true);
              }}
              onDeleteDiner={handleDeleteDiner}
            />

            {/* Tab Navigation */}
            <div className="grid grid-cols-2 p-1 bg-slate-900/90 rounded-xl border border-slate-800 text-xs font-bold shadow-inner">
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setActiveTab('items');
                }}
                className={`py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'items'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ListChecks className="w-4 h-4" />
                <span>1. Ticket</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setActiveTab('summary');
                }}
                className={`py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'summary'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calculator className="w-4 h-4" />
                <span>2. Cuentas & Pago</span>
              </button>
            </div>

            {/* Tab 1: Ticket View */}
            {activeTab === 'items' && (
              <TicketView
                items={items}
                diners={diners}
                currentDinerId={currentDinerId}
                presets={presets}
                totals={tableTotals}
                tipPercentage={tipPercentage}
                onOpenAddDiner={() => {
                  playTapSound();
                  setAddDinerModalOpen(true);
                }}
                onSplitAll={handleSplitAll}
                onSetItemMode={handleSetItemMode}
                onToggleShared={handleToggleShared}
                onStepUnits={handleStepUnits}
                onSetUnits={handleSetUnits}
                onLoadPreset={handleLoadPreset}
              />
            )}

            {/* Tab 2: Summary View */}
            {activeTab === 'summary' && (
              <SummaryView
                paymentMode={paymentMode}
                singlePayerId={singlePayerId}
                diners={diners}
                items={items}
                tableTotals={tableTotals}
                dinerTotalsMap={dinerTotalsMap}
                tipPercentage={tipPercentage}
                coverCharge={coverCharge}
                collectorAlias={collectorAlias}
                onSetPaymentMode={mode => {
                  playTapSound();
                  setPaymentMode(mode);
                  if (mode === 'single' && !singlePayerId && diners.length > 0) {
                    setSinglePayerId(diners[0].id);
                  }
                }}
                onSetSinglePayer={id => {
                  playTapSound();
                  setSinglePayerId(id);
                }}
                onSetPayerAlias={alias => {
                  setDiners(prev =>
                    prev.map(d => (d.id === singlePayerId ? { ...d, alias: alias.trim() } : d))
                  );
                }}
                onSetTip={tip => {
                  playTapSound();
                  setTipPercentage(tip);
                  showToast(`Propina al ${tip}%`);
                }}
                onSetCoverCharge={charge => {
                  setCoverCharge(charge);
                }}
                onDistributeUnassigned={handleDistributeUnassigned}
                onTogglePaid={handleTogglePaid}
                onCopyAlias={handleCopyAlias}
                onShareWhatsApp={handleShareWhatsApp}
              />
            )}
          </div>
        ) : (
          /* MODO RESTAURANTE */
          <AdminPanel
            restaurantName={restaurantName}
            collectorAlias={collectorAlias}
            items={items}
            presets={presets}
            onUpdateRestaurantName={name => {
              setRestaurantName(name.trim() || 'Restaurante');
              showToast('Nombre actualizado');
            }}
            onUpdateCollectorAlias={alias => {
              setCollectorAlias(alias.trim() || 'dividimesa.mp');
              showToast('Alias actualizado');
            }}
            onLockAdmin={handleLockAdmin}
            onOpenImport={() => {
              playTapSound();
              setImportModalOpen(true);
            }}
            onOpenAddItem={() => {
              playTapSound();
              setAddItemModalOpen(true);
            }}
            onClearItems={handleClearItems}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onLoadPreset={handleLoadPreset}
            onSaveCurrentPreset={handleSaveCurrentPreset}
            onDeletePreset={handleDeletePreset}
            onChangePin={() => {
              playTapSound();
              setPinModalMode('change');
              setPinModalOpen(true);
            }}
          />
        )}
      </main>

      {/* Modals */}
      <PinModal
        isOpen={pinModalOpen}
        mode={pinModalMode}
        onClose={() => setPinModalOpen(false)}
        onSuccess={handleAdminSuccess}
        onToast={showToast}
      />

      <QrModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        onToast={showToast}
      />

      <ScannerModal
        isOpen={scannerModalOpen}
        onClose={() => setScannerModalOpen(false)}
        onScanSuccess={(scannedItems, mode) => {
          if (mode === 'replace') {
            setItems(scannedItems);
          } else {
            setItems(prev => [...prev, ...scannedItems]);
          }
          showToast(`¡${scannedItems.length} platos escaneados del ticket!`);
        }}
      />

      <AddItemModal
        isOpen={addItemModalOpen}
        onClose={() => setAddItemModalOpen(false)}
        onSave={handleSaveItem}
      />

      <AddDinerModal
        isOpen={addDinerModalOpen}
        onClose={() => setAddDinerModalOpen(false)}
        onSave={handleSaveDiner}
      />

      <UserSwitchModal
        isOpen={userSwitchModalOpen}
        diners={diners}
        currentDinerId={currentDinerId}
        onClose={() => setUserSwitchModalOpen(false)}
        onSelectDiner={handleSelectDiner}
        onOpenAddDiner={() => {
          playTapSound();
          setAddDinerModalOpen(true);
        }}
      />

      <ImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportItems}
        onToast={showToast}
      />

      <AskModal
        state={askModalState}
        onClose={() => setAskModalState(prev => ({ ...prev, isOpen: false }))}
      />

      <AdminLicenseModal
        isOpen={adminLicenseModalOpen}
        onClose={() => setAdminLicenseModalOpen(false)}
        onToast={showToast}
      />

      {/* Toast Notification */}
      <div
        className={`fixed top-20 left-1/2 -translate-x-1/2 z-[70] bg-slate-900/95 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-full text-xs font-bold shadow-2xl transition-all duration-300 pointer-events-none ${
          toastVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95'
        }`}
      >
        <span>{toastMessage}</span>
      </div>
    </div>
  );
}
