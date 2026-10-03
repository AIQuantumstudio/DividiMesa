import React, { useState, useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import { getLockoutRemainingSeconds, verifyPin, hashPin, setStoredPin } from '../../utils/pin';

interface PinModalProps {
  isOpen: boolean;
  mode: 'unlock' | 'create' | 'change';
  onClose: () => void;
  onSuccess: () => void;
  onToast: (msg: string) => void;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  mode,
  onClose,
  onSuccess,
  onToast
}) => {
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setPin2('');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const isTwoFields = mode === 'create' || mode === 'change';

  const title =
    mode === 'create'
      ? 'Creá tu clave de restaurante'
      : mode === 'change'
      ? 'Nueva clave'
      : 'Acceso del restaurante';

  const desc =
    mode === 'create'
      ? 'Primera vez: elegí una clave de 4 a 12 números. Solo vos la vas a saber, los clientes no podrán entrar al panel.'
      : mode === 'change'
      ? 'Elegí la nueva clave (4 a 12 números).'
      : 'Ingresá la clave para abrir el panel del restaurante.';

  const triggerError = (msg: string) => {
    setError(msg);
    setShaking(true);
    setTimeout(() => setShaking(false), 350);
  };

  const handleSubmit = async () => {
    const p = pin.trim();

    if (mode === 'unlock') {
      const remaining = getLockoutRemainingSeconds();
      if (remaining > 0) {
        triggerError(`Demasiados intentos. Esperá ${remaining} s`);
        return;
      }

      const res = await verifyPin(p);
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        triggerError(res.error || 'Clave incorrecta');
        setPin('');
      }
      return;
    }

    // create or change mode
    if (!/^\d{4,12}$/.test(p)) {
      triggerError('Usá entre 4 y 12 números');
      return;
    }

    if (p !== pin2.trim()) {
      triggerError('Las claves no coinciden');
      return;
    }

    const hashed = await hashPin(p);
    setStoredPin(hashed);
    onClose();

    if (mode === 'create') {
      onSuccess();
    } else {
      onToast('Clave actualizada');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <div
        className={`glass-panel w-full max-w-sm rounded-2xl p-5 border border-amber-500/30 space-y-4 text-center ${
          shaking ? 'shake' : ''
        }`}
      >
        <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto text-2xl shadow-lg">
          <Lock className="w-6 h-6 text-amber-400" />
        </div>

        <div>
          <h3 className="font-extrabold text-base text-white">{title}</h3>
          <p className="text-xs text-slate-400 mt-1">{desc}</p>
        </div>

        <div className="space-y-2">
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={12}
            value={pin}
            placeholder="Clave"
            onChange={e => setPin(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-center text-lg tracking-[.4em] font-bold text-amber-400 focus:outline-none focus:border-amber-500"
          />

          {isTwoFields && (
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={12}
              value={pin2}
              placeholder="Repetir clave"
              onChange={e => setPin2(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-center text-lg tracking-[.4em] font-bold text-amber-400 focus:outline-none focus:border-amber-500"
            />
          )}

          <p className="text-xs text-rose-400 font-bold min-h-[1.25rem]">{error}</p>
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
            onClick={handleSubmit}
            className="w-1/2 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md"
          >
            {isTwoFields ? 'Guardar' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
};
