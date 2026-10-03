import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, Loader2, Image as ImageIcon, Trash2, Plus, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { Item, ItemMode } from '../../types';
import { parseReceiptText } from '../../utils/receiptParser';
import { money } from '../../utils/format';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (items: Item[], mode: 'replace' | 'append') => void;
}

type ScanStep = 'camera' | 'processing' | 'review' | 'manual';

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess
}) => {
  const [step, setStep] = useState<ScanStep>('camera');
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [extractedItems, setExtractedItems] = useState<Item[]>([]);
  const [rawOcrText, setRawOcrText] = useState<string>('');
  const [cameraError, setCameraError] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Start camera when modal opens in camera step
  useEffect(() => {
    if (isOpen && step === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, step, facingMode]);

  // Reset states on open
  useEffect(() => {
    if (isOpen) {
      setStep('camera');
      setProgress(0);
      setStatusMessage('');
      setExtractedItems([]);
      setRawOcrText('');
      setCameraError('');
    }
  }, [isOpen]);

  const startCamera = async () => {
    stopCamera();
    setCameraError('');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Navegador sin soporte de cámara en tiempo real');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => {
          console.warn('Video play error:', err);
        });
      }
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      setCameraError('No se pudo acceder a la cámara directa. Podés usar "Subir foto del ticket" abajo.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Flip camera between back and front
  const toggleFacingMode = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Pre-process canvas for receipt OCR (convert to grayscale + increase contrast)
  const preprocessCanvas = (sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = sourceCanvas.width;
    outputCanvas.height = sourceCanvas.height;
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) return sourceCanvas;

    ctx.drawImage(sourceCanvas, 0, 0);
    const imgData = ctx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    const d = imgData.data;

    // Contrast factor
    const contrast = 35;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < d.length; i += 4) {
      // Grayscale luminance formula
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      // Apply contrast
      const adjusted = factor * (gray - 128) + 128;
      const finalColor = Math.min(255, Math.max(0, adjusted));

      d[i] = finalColor;
      d[i + 1] = finalColor;
      d[i + 2] = finalColor;
    }

    ctx.putImageData(imgData, 0, 0);
    return outputCanvas;
  };

  const processImageToOCR = async (canvas: HTMLCanvasElement) => {
    stopCamera();
    setStep('processing');
    setProgress(5);
    setStatusMessage('Preparando imagen del ticket...');

    try {
      const processed = preprocessCanvas(canvas);

      setStatusMessage('Inicializando motor OCR...');
      setProgress(15);

      const result = await Tesseract.recognize(processed, 'spa+eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(15 + m.progress * 80);
            setProgress(pct);
            setStatusMessage(`Analizando caracteres y precios: ${Math.round(m.progress * 100)}%`);
          } else if (m.status === 'loading tesseract core') {
            setStatusMessage('Cargando motor de reconocimiento...');
          }
        }
      });

      setProgress(98);
      setStatusMessage('Extrayendo platos y precios...');

      const text = result.data.text || '';
      setRawOcrText(text);

      const parsed = parseReceiptText(text);

      if (parsed.length > 0) {
        setExtractedItems(parsed);
        setStep('review');
      } else {
        // Fallback to manual review
        setStep('manual');
      }
    } catch (err: any) {
      console.error('OCR processing error:', err);
      setStatusMessage('Hubo un error procesando el ticket. Podés reintentar o cargar platos manualmente.');
      setStep('manual');
    }
  };

  // Capture snapshot from live video
  const handleCaptureVideo = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    processImageToOCR(canvas);
  };

  // Handle image upload from file or native camera
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          processImageToOCR(canvas);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Review item actions
  const handleUpdateItem = (id: number, field: keyof Item, value: any) => {
    setExtractedItems(prev =>
      prev.map(it => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const handleDeleteItem = (id: number) => {
    setExtractedItems(prev => prev.filter(it => it.id !== id));
  };

  const handleAddNewItem = () => {
    const newItem: Item = {
      id: Date.now(),
      name: 'Nuevo ítem',
      price: 2500,
      qty: 1,
      mode: 'units',
      shares: {}
    };
    setExtractedItems(prev => [...prev, newItem]);
  };

  const handleReprocessManual = () => {
    const parsed = parseReceiptText(rawOcrText);
    if (parsed.length > 0) {
      setExtractedItems(parsed);
      setStep('review');
    }
  };

  const handleConfirmItems = (mode: 'replace' | 'append') => {
    if (extractedItems.length === 0) return;
    onScanSuccess(extractedItems, mode);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="glass-panel w-full max-w-md rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xl border border-slate-700/80 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-2 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Escáner de Ticket Real</h3>
              <p className="text-[10px] text-slate-400">
                {step === 'camera' && 'Apuntá al ticket con buena luz'}
                {step === 'processing' && 'Digitalizando ticket con OCR'}
                {step === 'review' && `${extractedItems.length} platos detectados`}
                {step === 'manual' && 'Revisión del texto leído'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: CAMERA VIEWFINDER */}
        {step === 'camera' && (
          <div className="space-y-3 flex-1 flex flex-col overflow-y-auto">
            <div className="relative w-full aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden border-2 border-dashed border-emerald-500/50 flex flex-col items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Laser animation */}
              <div className="scanner-laser inset-x-0" />

              {/* Viewfinder frame guide */}
              <div className="absolute inset-4 border border-emerald-400/40 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                <div className="flex justify-between">
                  <span className="w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                  <span className="w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                </div>
                <div className="text-center">
                  <span className="bg-slate-900/80 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm border border-emerald-500/30">
                    Alineá las columnas del ticket
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                  <span className="w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
                </div>
              </div>

              {/* Camera Switch button */}
              <button
                type="button"
                onClick={toggleFacingMode}
                className="absolute top-3 right-3 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-slate-200 border border-slate-700 active:scale-95 transition-all text-xs"
                title="Cambiar cámara"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {cameraError && (
              <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl">
                {cameraError}
              </p>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-sky-400" />
                <span>Subir foto / Archivo</span>
              </button>

              <button
                type="button"
                onClick={handleCaptureVideo}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Capturar foto</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

        {/* STEP 2: PROCESSING */}
        {step === 'processing' && (
          <div className="py-10 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-emerald-400 animate-spin" />
              <Loader2 className="w-6 h-6 text-emerald-400 absolute inset-0 m-auto" />
            </div>

            <div className="space-y-1">
              <h4 className="font-extrabold text-sm text-slate-100">Escaneando ticket...</h4>
              <p className="text-xs text-slate-400 max-w-xs">{statusMessage}</p>
            </div>

            <div className="w-4/5 bg-slate-900 border border-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-400 to-emerald-400 h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">{progress}%</span>
          </div>
        )}

        {/* STEP 3: REVIEW EXTRACTED ITEMS */}
        {step === 'review' && (
          <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
            <div className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Platos leídos con éxito</span>
              </span>
              <button
                type="button"
                onClick={handleAddNewItem}
                className="text-[11px] bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold px-2 py-1 rounded-lg border border-slate-700 flex items-center gap-1 active:scale-95 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>+ Agregar otro</span>
              </button>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-56">
              {extractedItems.map(it => (
                <div
                  key={it.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      value={it.name}
                      onChange={e => handleUpdateItem(it.id, 'name', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        value={it.price}
                        onChange={e => handleUpdateItem(it.id, 'price', parseFloat(e.target.value) || 0)}
                        className="w-20 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 font-bold text-emerald-400 focus:outline-none"
                      />
                      <span className="text-slate-400">Cant:</span>
                      <input
                        type="number"
                        min="1"
                        value={it.qty}
                        onChange={e => handleUpdateItem(it.id, 'qty', parseInt(e.target.value) || 1)}
                        className="w-12 bg-slate-800 border border-slate-700 rounded px-1 text-center font-bold focus:outline-none"
                      />
                      <span className="text-[11px] text-slate-400 ml-auto font-mono">
                        {money(it.price * it.qty)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(it.id)}
                    className="text-rose-400 hover:text-rose-300 p-1.5 cursor-pointer"
                    title="Eliminar plato"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-slate-800 space-y-2 shrink-0">
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setStep('camera')}
                  className="w-1/3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold active:scale-95 transition-all cursor-pointer"
                >
                  Volver a escanear
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmItems('replace')}
                  className="w-2/3 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-xl text-xs active:scale-95 transition-all shadow-md cursor-pointer"
                >
                  Cargar {extractedItems.length} platos al ticket
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: MANUAL TEXT REVIEW (if low-contrast or custom receipt format) */}
        {step === 'manual' && (
          <div className="space-y-3 flex-1 flex flex-col overflow-y-auto">
            <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl text-xs text-amber-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Texto leído del ticket</p>
                <p className="text-[11px] text-slate-300">
                  Revisá el texto extraído por la cámara o editá para procesar los platos:
                </p>
              </div>
            </div>

            <textarea
              rows={6}
              value={rawOcrText}
              onChange={e => setRawOcrText(e.target.value)}
              placeholder="Ejemplo:&#10;1 Milanesa Napolitana 12500&#10;2 Coca Cola 4000&#10;1 Flan Casero 3500"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
            />

            <div className="flex space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setStep('camera')}
                className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 active:scale-95 transition-all cursor-pointer"
              >
                Tomar otra foto
              </button>
              <button
                type="button"
                onClick={handleReprocessManual}
                className="w-1/2 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs active:scale-95 transition-all shadow-md cursor-pointer"
              >
                Interpretar platos
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
