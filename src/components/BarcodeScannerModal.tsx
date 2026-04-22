import { useEffect, useRef, useState } from 'react';
import { Camera, ScanLine, X } from 'lucide-react';
import { Language, translations } from '../lib/translations';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  language: Language;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}

const SUPPORTED_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'codabar'];

const BarcodeScannerModal = ({ isOpen, language, onClose, onDetected }: BarcodeScannerModalProps) => {
  const t = translations[language];
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [detectedBarcode, setDetectedBarcode] = useState('');

  const stopScanner = () => {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setError('');
      setManualBarcode('');
      setDetectedBarcode('');
      return;
    }

    let cancelled = false;

    const startScanner = async () => {
      if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        setError(t.scanner_not_supported);
        return;
      }

      if (!('BarcodeDetector' in window)) {
        setError(t.scanner_not_supported);
        return;
      }

      setIsStarting(true);
      setError('');

      try {
        try {
          detectorRef.current = new BarcodeDetector({ formats: SUPPORTED_FORMATS });
        } catch {
          detectorRef.current = new BarcodeDetector();
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const scanFrame = async () => {
          if (cancelled || !videoRef.current || !detectorRef.current) return;

          try {
            const barcodes = await detectorRef.current.detect(videoRef.current);
            const match = barcodes.find((barcode) => barcode.rawValue?.trim());

            if (match?.rawValue) {
              const normalized = match.rawValue.trim();
              setDetectedBarcode(normalized);
              stopScanner();
              onDetected(normalized);
              onClose();
              return;
            }
          } catch {
            setError(t.scanner_not_supported);
            stopScanner();
            return;
          }

          frameRef.current = window.requestAnimationFrame(scanFrame);
        };

        frameRef.current = window.requestAnimationFrame(scanFrame);
      } catch (cameraError) {
        console.error('Barcode scanner failed to start', cameraError);
        setError(t.scanner_permission_denied);
      } finally {
        setIsStarting(false);
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [isOpen, onClose, onDetected, t.scanner_not_supported, t.scanner_permission_denied]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
              <ScanLine className="h-6 w-6 text-orange-500" />
              {t.scan_barcode}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {language === 'ar' ? 'وجّه الكاميرا نحو الباركود أو أدخله يدوياً.' : 'Pointez la caméra vers le code-barres ou saisissez-le manuellement.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-950 dark:border-gray-700">
          <div className="relative aspect-[4/3] w-full">
            <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-40 w-64 rounded-2xl border-2 border-orange-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            {isStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur">
                  {language === 'ar' ? 'جارٍ تشغيل الكاميرا...' : 'Démarrage de la caméra...'}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {detectedBarcode && (
            <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
              {t.barcode_detected}: <span className="font-bold">{detectedBarcode}</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t.manual_barcode_entry}
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                inputMode="numeric"
                className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="EAN / UPC / Code 128"
                value={manualBarcode}
                onChange={(event) => setManualBarcode(event.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  const normalized = manualBarcode.trim();
                  if (!normalized) return;
                  onDetected(normalized);
                  onClose();
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 font-bold text-white transition-colors hover:bg-orange-600"
              >
                <Camera className="h-4 w-4" />
                {language === 'ar' ? 'استخدام الرمز' : 'Utiliser ce code'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScannerModal;
