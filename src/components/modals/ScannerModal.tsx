import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  X,
  Loader2,
  Image as ImageIcon,
  Trash2,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Upload,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Wand2
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import { Item, ItemMode } from '../../types';
import { parseReceiptText } from '../../utils/receiptParser';
import { money } from '../../utils/format';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (items: Item[], mode: 'replace' | 'append') => void;
}

type ScanStep = 'camera' | 'processing' | 'review' | 'failed' | 'manual';

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess
}) => {
  const [step, setStep] = useState<ScanStep>('camera');
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Analizando...');
  const [extractedItems, setExtractedItems] = useState<Item[]>([]);
  const [rawOcrText, setRawOcrText] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);

  // Stop media stream tracks cleanly
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Start mobile camera stream with fallbacks
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    // Check secure context and browser support
    if (typeof window !== 'undefined' && !window.isSecureContext && location.hostname !== 'localhost') {
      setCameraError('El navegador requiere HTTPS para acceder a la cámara.');
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError('Tu navegador no soporta acceso directo a la cámara. Podés subir una foto del ticket desde tu celular.');
      return;
    }

    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode },
          audio: false
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        } catch (err: any) {
          const errName = err?.name || '';
          if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
            setCameraError('Necesitamos acceso a la cámara para escanear el ticket.');
          } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
            setCameraError('No se detectó una cámara disponible en este dispositivo.');
          } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
            setCameraError('La cámara está siendo utilizada por otra aplicación en tu celular.');
          } else {
            setCameraError('No se pudo abrir la cámara. Podés subir una foto del ticket desde tu celular.');
          }
          return;
        }
      }
    }

    if (!stream) {
      setCameraError('No se pudo acceder a la cámara.');
      return;
    }

    streamRef.current = stream;

    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');

      video.onloadedmetadata = () => {
        video
          .play()
          .then(() => setIsCameraActive(true))
          .catch(e => {
            console.warn('Video play interrupted:', e);
            setIsCameraActive(true);
          });
      };
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (isOpen) {
      setStep('camera');
      setProgress(0);
      setStatusMessage('Analizando...');
      setExtractedItems([]);
      setRawOcrText('');
      setCameraError(null);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  const toggleFacingMode = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  /**
   * Pre-process receipt image for mobile OCR (downscaling + auto-levels contrast)
   */
  const preprocessImage = (sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    let width = sourceCanvas.width;
    let height = sourceCanvas.height;

    const MAX_DIM = 1920;
    if (width > MAX_DIM || height > MAX_DIM) {
      if (width > height) {
        height = Math.round((height * MAX_DIM) / width);
        width = MAX_DIM;
      } else {
        width = Math.round((width * MAX_DIM) / height);
        height = MAX_DIM;
      }
    }

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = width;
    outputCanvas.height = height;
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) return sourceCanvas;

    ctx.drawImage(sourceCanvas, 0, 0, width, height);

    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;

      let minLum = 255;
      let maxLum = 0;

      const stepSample = Math.max(1, Math.floor(d.length / 40000));
      for (let i = 0; i < d.length; i += 4 * stepSample) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (lum < minLum) minLum = lum;
        if (lum > maxLum) maxLum = lum;
      }

      const lumRange = Math.max(20, maxLum - minLum);
      const contrast = 35;
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const normalized = ((gray - minLum) / lumRange) * 255;
        const adjusted = factor * (normalized - 128) + 128;
        const finalColor = Math.min(255, Math.max(0, adjusted));

        d[i] = finalColor;
        d[i + 1] = finalColor;
        d[i + 2] = finalColor;
      }

      ctx.putImageData(imgData, 0, 0);
      return outputCanvas;
    } catch {
      return sourceCanvas;
    }
  };

  /**
   * Hybrid ticket processing pipeline:
   * 1. Try server-side structured AI extraction (if available via /api/scan-ticket)
   * 2. Deterministically validate items
   * 3. Fallback to client-side Tesseract.js with deterministic receiptParser
   */
  const processImageToOCR = async (canvas: HTMLCanvasElement) => {
    stopCamera();
    setStep('processing');
    setProgress(15);
    setStatusMessage('Procesando imagen del ticket...');

    const processed = preprocessImage(canvas);
    const imageBase64 = processed.toDataURL('image/jpeg', 0.85);

    // Strategy A: Try server-side structured recognition
    try {
      setStatusMessage('Analizando productos y precios unitarios...');
      setProgress(35);

      const response = await fetch('/api/scan-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType: 'image/jpeg'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.items) && data.items.length > 0) {
          setProgress(95);
          setStatusMessage('Validando relación matemática de precios...');

          const mapped: Item[] = data.items.map((it: any, idx: number) => {
            const isBeverage = /(vino|cerveza|gaseosa|coca|agua|jarra|champagne|fernet|aperol|trago|botella)/i.test(it.nombre_producto);
            const mode: ItemMode = isBeverage ? 'shared' : 'units';
            const qty = Math.max(1, Math.round(Number(it.cantidad) || 1));
            const unitPrice = Math.round(Number(it.precio_unitario_ars || 0) * 100) / 100;
            const lineTotal = Math.round(Number(it.importe_linea_ars || qty * unitPrice) * 100) / 100;

            const expected = Math.round(qty * unitPrice * 100) / 100;
            const diff = Math.abs(expected - lineTotal);
            const needsReview = Boolean(it.requiere_revision) || diff > 1;

            return {
              id: Date.now() + idx * 10,
              name: String(it.nombre_producto || '').trim(),
              qty,
              price: unitPrice,
              lineTotal,
              currency: 'ARS',
              confidence: Number(it.confianza_lectura) || 1.0,
              needsReview,
              reviewReason: it.motivo_revision || (diff > 1 ? `Importe ($${lineTotal}) difiere de Cantidad (${qty}) × P. Unitario ($${unitPrice})` : undefined),
              mode,
              shares: {}
            };
          });

          setExtractedItems(mapped);
          setStep('review');
          return;
        }
      }
    } catch {
      // Server endpoint not available; proceed to local Tesseract
    }

    // Strategy B: Fallback to local client-side Tesseract.js OCR
    try {
      setStatusMessage('Iniciando lector local...');
      setProgress(40);

      const result = await Tesseract.recognize(processed, 'spa+eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(40 + m.progress * 50);
            setProgress(pct);
            setStatusMessage(`Analizando caracteres: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      setProgress(95);
      setStatusMessage('Extrayendo columnas de productos y precios...');

      const text = result.data.text || '';
      setRawOcrText(text);

      const parsed = parseReceiptText(text);

      if (parsed && parsed.length > 0) {
        setExtractedItems(parsed);
        setStep('review');
      } else {
        setStep('failed');
      }
    } catch (err: any) {
      console.warn('OCR error:', err);
      setStep('failed');
    }
  };

  const handleCaptureVideo = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      nativeCameraInputRef.current?.click();
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    processImageToOCR(canvas);
  };

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
    e.target.value = '';
  };

  // Review item actions
  const handleUpdateItem = (id: number, field: keyof Item, value: any) => {
    setExtractedItems(prev =>
      prev.map(it => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: value };

        // Re-evaluate mathematical match when qty, price, or lineTotal changes
        if (field === 'price' || field === 'qty' || field === 'lineTotal') {
          const expected = Math.round((updated.qty || 1) * (updated.price || 0) * 100) / 100;
          const currentTotal = updated.lineTotal ?? expected;
          const diff = Math.abs(expected - currentTotal);

          if (diff <= 1) {
            updated.needsReview = false;
            updated.confidence = 1.0;
            updated.reviewReason = undefined;
          } else {
            updated.needsReview = true;
            updated.reviewReason = `Importe ($${currentTotal}) difiere de Cantidad (${updated.qty}) × P. Unitario ($${updated.price}). Posible promo o descuento.`;
          }
        }
        return updated;
      })
    );
  };

  const handleSyncLineTotal = (id: number) => {
    setExtractedItems(prev =>
      prev.map(it => {
        if (it.id !== id) return it;
        const synced = Math.round(it.qty * it.price * 100) / 100;
        return {
          ...it,
          lineTotal: synced,
          needsReview: false,
          confidence: 1.0,
          reviewReason: undefined
        };
      })
    );
  };

  const handleDeleteItem = (id: number) => {
    setExtractedItems(prev => prev.filter(it => it.id !== id));
  };

  const handleAddNewItem = () => {
    const newItem: Item = {
      id: Date.now(),
      name: 'Nuevo producto',
      price: 2500,
      qty: 1,
      lineTotal: 2500,
      currency: 'ARS',
      confidence: 1.0,
      needsReview: false,
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
    } else {
      setStep('failed');
    }
  };

  const handleConfirmItems = (mode: 'replace' | 'append') => {
    if (extractedItems.length === 0) return;
    onScanSuccess(extractedItems, mode);
    onClose();
  };

  const totalCalculated = extractedItems.reduce((acc, it) => acc + (it.lineTotal ?? it.price * it.qty), 0);
  const totalUnits = extractedItems.reduce((acc, it) => acc + it.qty, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4">
      <div className={`glass-panel w-full ${step === 'review' ? 'max-w-2xl' : 'max-w-md'} rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xl border border-slate-700/80 max-h-[95vh] flex flex-col transition-all duration-300`}>
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-2.5 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/10">
              <Camera className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100">
                {step === 'review' ? 'Revisión de Productos del Ticket' : 'Escáner de Ticket'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {step === 'camera' && 'Apuntá al ticket con buena luz'}
                {step === 'processing' && 'Digitalizando con precisión contable...'}
                {step === 'review' && `${extractedItems.length} productos identificados • Revisá los precios antes de confirmar`}
                {step === 'failed' && 'Resultado del escaneo'}
                {step === 'manual' && 'Revisión manual de texto'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 cursor-pointer p-1.5 rounded-lg active:scale-95 transition-all"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: CAMERA & CAPTURE */}
        {step === 'camera' && (
          <div className="space-y-3 flex-1 flex flex-col overflow-y-auto">
            <div className="relative w-full aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden border-2 border-dashed border-emerald-500/50 flex flex-col items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  isCameraActive && !cameraError ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {isCameraActive && !cameraError && (
                <>
                  <div className="scanner-laser inset-x-0" />
                  <div className="absolute inset-4 border border-emerald-400/40 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                    <div className="flex justify-between">
                      <span className="w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                      <span className="w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                    </div>
                    <div className="text-center">
                      <span className="bg-slate-900/85 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full backdrop-blur-sm border border-emerald-500/30">
                        Alineá platos, cantidad y precios
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                      <span className="w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="absolute top-3 right-3 p-2 rounded-xl bg-slate-900/85 hover:bg-slate-900 text-slate-200 border border-slate-700 active:scale-95 transition-all cursor-pointer shadow-md"
                    title="Cambiar a cámara trasera o frontal"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </>
              )}

              {!isCameraActive && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 p-4 text-center">
                  <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
                  <p className="text-xs font-bold text-slate-300">Iniciando cámara...</p>
                  <p className="text-[11px] text-slate-500">Solicitando permiso al dispositivo</p>
                </div>
              )}

              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center space-y-2.5 bg-slate-950/95">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-100">{cameraError}</p>
                    <p className="text-[11px] text-slate-400 max-w-[240px]">
                      Podés seleccionar una foto existente del ticket o tomar una foto con la cámara de tu celular.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="mt-1 py-2 px-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Seleccionar imagen desde el teléfono</span>
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-sm"
              >
                <ImageIcon className="w-4 h-4 text-sky-400" />
                <span>Subir foto del ticket</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isCameraActive && !cameraError) {
                    handleCaptureVideo();
                  } else {
                    nativeCameraInputRef.current?.click();
                  }
                }}
                className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md cursor-pointer"
              >
                <Camera className="w-4 h-4 stroke-[2.5]" />
                <span>Capturar ticket</span>
              </button>
            </div>

            <p className="text-[10px] text-center text-slate-500">
              💡 Para mejores resultados, apoyá el ticket sobre una mesa con buena luz.
            </p>

            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            <input
              ref={nativeCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

        {/* STEP 2: PROCESSING (OCR) */}
        {step === 'processing' && (
          <div className="py-10 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-emerald-400 animate-spin" />
              <Loader2 className="w-6 h-6 text-emerald-400 absolute inset-0 m-auto" />
            </div>

            <div className="space-y-1">
              <h4 className="font-extrabold text-sm text-slate-100">Procesando ticket...</h4>
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

        {/* STEP 3: REVIEW EXTRACTED ITEMS TABLE (EXACT USER SPECIFICATION) */}
        {step === 'review' && (
          <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
            {/* Summary Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 rounded-xl shrink-0">
              <div>
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{extractedItems.length} productos identificados ({totalUnits} unidades en mesa)</span>
                </span>
                <span className="text-xs font-mono font-black text-white block mt-0.5">
                  Importe total del ticket: <span className="text-emerald-400">{money(totalCalculated)}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddNewItem}
                className="text-[11px] bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold px-2.5 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1 active:scale-95 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Agregar producto</span>
              </button>
            </div>

            {/* Instruction Notice */}
            <div className="text-[11px] text-slate-400 px-1 leading-tight flex items-center gap-1.5 shrink-0">
              <HelpCircle className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>
                El <b>Precio unitario</b> es el valor asignado por cada porción que consuma un comensal.
              </span>
            </div>

            {/* TABLE / CARDS CONTAINER */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[52vh]">
              {/* Desktop Table Headers */}
              <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1 bg-slate-900/60 rounded-lg border border-slate-800/80">
                <span className="col-span-5">Producto</span>
                <span className="col-span-1 text-center">Cant.</span>
                <span className="col-span-2 text-right">P. Unitario</span>
                <span className="col-span-2 text-right">Importe Línea</span>
                <span className="col-span-2 text-center">Estado</span>
              </div>

              {extractedItems.map(it => {
                const calculatedExpected = Math.round(it.qty * it.price * 100) / 100;
                const actualLine = it.lineTotal ?? calculatedExpected;
                const hasDiff = Math.abs(calculatedExpected - actualLine) > 1;
                const isWarning = it.needsReview || hasDiff;

                return (
                  <div
                    key={it.id}
                    className={`bg-slate-900/90 border rounded-xl p-2.5 sm:p-3 transition-all space-y-2 ${
                      isWarning
                        ? 'border-amber-500/50 bg-amber-950/10'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Row Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs">
                      {/* 1. Producto */}
                      <div className="sm:col-span-5">
                        <label className="sm:hidden text-[10px] font-bold text-slate-400 block mb-0.5">
                          Producto:
                        </label>
                        <input
                          type="text"
                          value={it.name}
                          onChange={e => handleUpdateItem(it.id, 'name', e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
                          placeholder="Nombre del producto"
                        />
                      </div>

                      {/* 2. Cantidad */}
                      <div className="sm:col-span-1 flex items-center justify-between sm:justify-center">
                        <label className="sm:hidden text-[10px] font-bold text-slate-400">
                          Cant:
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={it.qty}
                          onChange={e => handleUpdateItem(it.id, 'qty', parseInt(e.target.value, 10) || 1)}
                          className="w-14 sm:w-full bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-1.5 text-center font-bold text-slate-100 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      {/* 3. Precio Unitario */}
                      <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-1">
                        <label className="sm:hidden text-[10px] font-bold text-slate-400">
                          P. Unitario:
                        </label>
                        <div className="flex items-center gap-1 w-28 sm:w-full">
                          <span className="text-slate-500 font-bold">$</span>
                          <input
                            type="number"
                            min="0"
                            step="50"
                            value={it.price}
                            onChange={e => handleUpdateItem(it.id, 'price', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 font-bold text-emerald-400 text-right focus:outline-none focus:border-emerald-500"
                            title="Precio unitario individual"
                          />
                        </div>
                      </div>

                      {/* 4. Importe de Línea */}
                      <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-1">
                        <label className="sm:hidden text-[10px] font-bold text-slate-400">
                          Importe Línea:
                        </label>
                        <div className="flex items-center gap-1 w-28 sm:w-full">
                          <span className="text-slate-500 font-bold">$</span>
                          <input
                            type="number"
                            min="0"
                            step="50"
                            value={actualLine}
                            onChange={e => handleUpdateItem(it.id, 'lineTotal', parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 font-bold text-slate-100 text-right focus:outline-none focus:border-emerald-500"
                            title="Importe total facturado en la línea"
                          />
                        </div>
                      </div>

                      {/* 5. Estado & Delete */}
                      <div className="sm:col-span-2 flex items-center justify-between sm:justify-center gap-1 pt-1 sm:pt-0">
                        {isWarning ? (
                          <span
                            className="text-[10px] font-bold px-2 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1"
                            title={it.reviewReason || 'Discrepancia entre Cant × Unitario y Total'}
                          >
                            <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>Revisar</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>Correcto</span>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteItem(it.id)}
                          className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-950/40 cursor-pointer active:scale-95 transition-all"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Discrepancy Note & Auto-sync button if applicable */}
                    {isWarning && (
                      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80 text-[11px] text-amber-300/90 bg-amber-950/30 -mx-1 px-2.5 py-1.5 rounded-lg">
                        <span>
                          {it.reviewReason || `Cant (${it.qty}) × Unit ($${it.price}) = $${calculatedExpected} ≠ Importe $${actualLine}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSyncLineTotal(it.id)}
                          className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1 active:scale-95 cursor-pointer ml-auto"
                          title="Igualar Importe de Línea a Cantidad × Precio Unitario"
                        >
                          <Wand2 className="w-2.5 h-2.5" />
                          <span>Alinear a ${calculatedExpected}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-slate-800 space-y-2 shrink-0">
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setStep('camera')}
                  className="w-1/3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Volver a escanear</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmItems('replace')}
                  className="w-2/3 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-xl text-xs active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Confirmar {extractedItems.length} productos en Dividí Mesa</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: FAILURE */}
        {step === 'failed' && (
          <div className="space-y-4 flex-1 flex flex-col items-center justify-center text-center p-2">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="space-y-1.5 max-w-xs">
              <h4 className="font-extrabold text-sm text-slate-100">
                No pudimos leer correctamente el ticket.
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Asegurate de que el ticket esté bien iluminado, enfocado y que los precios y platos sean legibles.
              </p>
            </div>

            <div className="w-full space-y-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('camera')}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-xl text-xs active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Intentar nuevamente</span>
              </button>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-xl text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-sky-400" />
                <span>Seleccionar otra foto</span>
              </button>

              <button
                type="button"
                onClick={() => setStep('manual')}
                className="w-full py-2 text-slate-400 hover:text-slate-200 text-[11px] font-medium transition-all"
              >
                Cargar platos manualmente
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: MANUAL REVIEW */}
        {step === 'manual' && (
          <div className="space-y-3 flex-1 flex flex-col overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-xs text-slate-300">
              <p className="font-bold text-slate-100">Texto detectado:</p>
              <p className="text-[11px] text-slate-400">
                Podés corregir o pegar el texto de los platos (ej: 2 Agua Mineral 7400 \n Unit: 3700) y tocar Interpretar platos.
              </p>
            </div>

            <textarea
              rows={6}
              value={rawOcrText}
              onChange={e => setRawOcrText(e.target.value)}
              placeholder="2 AGUA MINERAL 7400,00&#10;Unit: 3700,00&#10;1 Parrillada Promo 24900,00"
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
