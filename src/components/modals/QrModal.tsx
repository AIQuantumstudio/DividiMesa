import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { QrCode, X, Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../../utils/format';

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export const QrModal: React.FC<QrModalProps> = ({ isOpen, onClose, onToast }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = React.useState(false);
  const tableUrl = window.location.href.split('#')[0];

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        tableUrl,
        {
          width: 172,
          margin: 1,
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          }
        },
        err => {
          if (err) console.error(err);
        }
      );
    }
  }, [isOpen, tableUrl]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    const ok = await copyToClipboard(tableUrl);
    if (ok) {
      setCopied(true);
      onToast('Enlace copiado');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-sm rounded-2xl p-5 space-y-4 text-center shadow-2xl border border-slate-700/60">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>QR de Mesa</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300">Los comensales escanean para sumarse a la mesa:</p>

        <div className="bg-white p-3 rounded-2xl w-52 h-52 mx-auto flex items-center justify-center border-4 border-emerald-500/30 shadow-inner">
          <canvas ref={canvasRef} className="rounded-lg" />
        </div>

        <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800 text-xs font-mono text-emerald-400 flex items-center justify-between">
          <span className="truncate mr-2 text-[11px] text-left">{tableUrl}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="text-slate-300 hover:text-white px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>Copiar</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-all cursor-pointer"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
