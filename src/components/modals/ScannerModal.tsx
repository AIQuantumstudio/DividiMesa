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
  Sparkles
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import { Item } from '../../types';
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

    // Strategy 1: Ideal rear camera (environment) with HD resolution
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
      // Strategy 2: Without resolution constraints (for restrictive mobile devices)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode },
          audio: false
        });
      } catch {
        // Strategy 3: Any video device
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

    // Bind to video element safely for iOS Safari and Android Chrome
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

  // Lifecycle when modal opens/closes
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

  // Toggle between rear and front camera
  const toggleFacingMode = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  /**
   * Pre-process receipt image for mobile OCR:
   * 1. Downscales proportionally if image exceeds 1920px (prevents mobile memory crashes).
   * 2. Converts to grayscale.
   * 3. Applies contrast stretching & sharpening to make thermal receipt text crisp against paper.
   */
  const preprocessImage = (sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    let width = sourceCanvas.width;
    let height = sourceCanvas.height;

    // Max dimension 1920px for optimal OCR speed & memory safety on mobile
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

    // Draw scaled
    ctx.drawImage(sourceCanvas, 0, 0, width, height);

    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;

      // Find min and max luminance for adaptive contrast stretching
      let minLum = 255;
      let maxLum = 0;

      // Sample a subset for performance
      const stepSample = Math.max(1, Math.floor(d.length / 40000));
      for (let i = 0; i < d.length; i += 4 * stepSample) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (lum < minLum) minLum = lum;
        if (lum > maxLum) maxLum = lum;
      }

      // Safe bounds
      const lumRange = Math.max(20, maxLum - minLum);

      // Contrast multiplier
      const contrast = 40;
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

        // Stretch dynamic range
        const normalized = ((gray - minLum) / lumRange) * 255;

        // Apply contrast
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
   * Run OCR using client-side Tesseract.js (100% free, local in browser)
   */
  const processImageToOCR = async (canvas: HTMLCanvasElement) => {
    stopCamera();
    setStep('processing');
    setProgress(10);
    setStatusMessage('Procesando ticket...');

    try {
      const processed = preprocessImage(canvas);

      setStatusMessage('Analizando texto y precios...');
      setProgress(25);

      const result = await Tesseract.recognize(processed, 'spa+eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(25 + m.progress * 70);
            setProgress(pct);
            setStatusMessage(`Analizando ticket: ${Math.round(m.progress * 100)}%`);
          } else if (m.status === 'loading tesseract core') {
            setStatusMessage('Iniciando lector...');
          }
        }
      });

      setProgress(98);
      setStatusMessage('Extrayendo productos...');

      const text = result.data.text || '';
      setRawOcrText(text);

      const parsed = parseReceiptText(text);

      if (parsed && parsed.length > 0) {
        setExtractedItems(parsed);
        setStep('review');
      } else {
        // Clear friendly failure step
        setStep('failed');
      }
    } catch (err: any) {
      console.warn('OCR error:', err);
      setStep('failed');
    }
  };

  // Capture frame from active live video
  const handleCaptureVideo = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      // If video is not ready, trigger native camera input as seamless fallback
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

  // Handle image selected from gallery or native camera file input
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

    // Reset input so same file can be reselected if needed
    e.target.value = '';
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
      name: 'Nuevo producto',
      price: 1000,
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
    } else {
      setStep('failed');
    }
  };

  const handleConfirmItems = (mode: 'replace' | 'append') => {
    if (extractedItems.length === 0) return;
    onScanSuccess(extractedItems, mode);
    onClose();
  };

  const totalCalculated = extractedItems.reduce((acc, it) => acc + it.price * it.qty, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="glass-panel w-full max-w-md rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xl border border-slate-700/80 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-2.5 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/10">
              <Camera className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100">Escáner de Ticket</h3>
              <p className="text-[11px] text-slate-400">
                {step === 'camera' && 'Apuntá al ticket con buena luz'}
                {step === 'processing' && 'Digitalizando con OCR...'}
                {step === 'review' && `${extractedItems.length} productos identificados`}
                {step === 'failed' && 'Resultado del escaneo'}
                {step === 'manual' && 'Revisión de texto'}
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
            {/* Viewfinder area */}
            <div className="relative w-full aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden border-2 border-dashed border-emerald-500/50 flex flex-col items-center justify-center shadow-inner">
              {/* Live video */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  isCameraActive && !cameraError ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* If camera is active and no error: show laser & viewfinder frame */}
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
                        Alineá platos y precios
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                      <span className="w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
                    </div>
                  </div>

                  {/* Switch camera button (front/back) */}
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

              {/* If camera is loading */}
              {!isCameraActive && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 p-4 text-center">
                  <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
                  <p className="text-xs font-bold text-slate-300">Iniciando cámara...</p>
                  <p className="text-[11px] text-slate-500">Solicitando permiso al dispositivo</p>
                </div>
              )}

              {/* If camera permission denied or unavailable */}
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

            {/* Actions Bar for Mobile: 2 primary options */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {/* Option A: Gallery / Files on Phone */}
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-sm"
              >
                <ImageIcon className="w-4 h-4 text-sky-400" />
                <span>Subir foto del ticket</span>
              </button>

              {/* Option B: Capture from Viewfinder or Native Camera */}
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

            {/* Hidden Input 1: Gallery / Phone Files (NO capture attribute) */}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Hidden Input 2: Native Camera direct snap (capture="environment") */}
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

        {/* STEP 3: REVIEW EXTRACTED ITEMS */}
        {step === 'review' && (
          <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
            {/* Success summary badge */}
            <div className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
              <div>
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Productos encontrados</span>
                </span>
                <span className="text-[11px] font-mono font-bold text-white block mt-0.5">
                  Total leído: {money(totalCalculated)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddNewItem}
                className="text-[11px] bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold px-2.5 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1 active:scale-95 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>+ Agregar plato</span>
              </button>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-60">
              {extractedItems.map(it => (
                <div
                  key={it.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      value={it.name}
                      onChange={e => handleUpdateItem(it.id, 'name', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-bold focus:outline-none focus:border-emerald-500"
                      placeholder="Nombre del plato"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        value={it.price}
                        onChange={e =>
                          handleUpdateItem(it.id, 'price', parseFloat(e.target.value) || 0)
                        }
                        className="w-24 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 font-bold text-emerald-400 focus:outline-none"
                      />
                      <span className="text-slate-400">Cant:</span>
                      <input
                        type="number"
                        min="1"
                        value={it.qty}
                        onChange={e =>
                          handleUpdateItem(it.id, 'qty', parseInt(e.target.value) || 1)
                        }
                        className="w-12 bg-slate-800 border border-slate-700 rounded px-1 text-center font-bold focus:outline-none"
                      />
                      <span className="text-[11px] text-slate-300 ml-auto font-mono font-bold">
                        {money(it.price * it.qty)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(it.id)}
                    className="text-rose-400 hover:text-rose-300 p-1.5 cursor-pointer active:scale-95"
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
                  className="w-1/3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reintentar</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmItems('replace')}
                  className="w-2/3 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black rounded-xl text-xs active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Cargar {extractedItems.length} platos al ticket</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: FAILURE (Non-technical friendly error screen) */}
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
                Asegurate de que el ticket esté bien iluminado, enfocado y que los precios sean legibles.
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

        {/* STEP 5: MANUAL REVIEW (optional fallback if user wants to see raw text or edit manually) */}
        {step === 'manual' && (
          <div className="space-y-3 flex-1 flex flex-col overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-xs text-slate-300">
              <p className="font-bold text-slate-100">Texto detectado:</p>
              <p className="text-[11px] text-slate-400">
                Podés corregir el texto o escribir los platos (ej: 1 Milanesa 12500) y tocar Interpretar platos.
              </p>
            </div>

            <textarea
              rows={6}
              value={rawOcrText}
              onChange={e => setRawOcrText(e.target.value)}
              placeholder="1 Milanesa Napolitana 12500&#10;2 Coca Cola 4000&#10;1 Flan Casero 3500"
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
