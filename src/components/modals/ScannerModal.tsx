import React, { useState } from 'react';
import { Camera, X, Receipt, Loader2 } from 'lucide-react';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: () => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess
}) => {
  const [isScanning, setIsScanning] = useState(false);

  if (!isOpen) return null;

  const handleRunOCR = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      onScanSuccess();
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-sm rounded-2xl p-5 space-y-4 text-center shadow-2xl border border-slate-700/60">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>Escáner de ticket</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative w-full h-56 bg-slate-900 rounded-2xl overflow-hidden border-2 border-dashed border-emerald-500/50 flex flex-col items-center justify-center p-4 shadow-inner">
          <div className="scanner-laser inset-x-0" />

          {isScanning ? (
            <div className="flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
              <p className="text-xs text-emerald-400 font-extrabold tracking-wide">
                Analizando ticket...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-2">
              <Receipt className="w-14 h-14 text-slate-600 stroke-1" />
              <p className="text-xs text-emerald-400 font-bold">Apuntá al ticket impreso</p>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={isScanning}
          onClick={handleRunOCR}
          className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs rounded-xl active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-50"
        >
          {isScanning ? 'Procesando...' : '📸 Escanear ticket (demo)'}
        </button>
      </div>
    </div>
  );
};
