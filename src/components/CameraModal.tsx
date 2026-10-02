import React, { useRef, useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, X, RefreshCw, Layers, Check, Zap, ZapOff } from 'lucide-react';
import type { IdSide } from '../types/scanner';
import { isNative, takeNativePhoto, pickNativePhoto, triggerHaptic, toggleTorch } from '../utils/nativeBridge';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageBase64: string, isBatch: boolean) => void;
  /** ID card mode: card-shaped frame, front then back prompts */
  idMode?: boolean;
  idSide?: IdSide;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  idMode = false,
  idSide = 'front',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [batchPref, setIsBatchMode] = useState<boolean>(true);
  const isBatchMode = idMode ? true : batchPref;
  const [capturedCount, setCapturedCount] = useState<number>(0);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setCapturedCount(0);
      setTorchOn(false);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    stopCamera();
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      // Check torch support
      const track = mediaStream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() as Record<string, unknown> | undefined;
      setTorchSupported(!!capabilities?.torch);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      console.warn('WebRTC Camera error fallback:', err);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
    setTorchSupported(false);
    setTorchOn(false);
  };

  const handleTorchToggle = async () => {
    await triggerHaptic();
    const newState = await toggleTorch(stream, torchOn);
    setTorchOn(newState);
  };

  const handleCapture = async () => {
    await triggerHaptic();

    // Native Capacitor Camera trigger
    if (isNative && !isCameraActive) {
      const photo = await takeNativePhoto();
      if (photo) {
        onCapture(photo, isBatchMode);
        setCapturedCount((prev) => prev + 1);
        if (!isBatchMode) onClose();
      }
      return;
    }

    // HTML5 Video Canvas capture
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        onCapture(dataUrl, isBatchMode);
        setCapturedCount((prev) => prev + 1);

        if (!isBatchMode) {
          onClose();
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            onCapture(event.target.result as string, isBatchMode);
            setCapturedCount((prev) => prev + 1);
          }
        };
        reader.readAsDataURL(file);
      });
      if (!isBatchMode) {
        onClose();
      }
    }
  };

  const handleNativePick = async () => {
    if (isNative) {
      const photo = await pickNativePhoto();
      if (photo) {
        onCapture(photo, isBatchMode);
        setCapturedCount((prev) => prev + 1);
        if (!isBatchMode) onClose();
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white select-none">
      {/* Top Bar with Safe Area Insets for Status Bar */}
      <div
        className="flex items-center justify-between px-4 pb-3 z-20 bg-gradient-to-b from-black via-black/90 to-transparent"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 28px), 28px)' }}
      >
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/90 border border-zinc-800 text-white backdrop-blur-md active:scale-95"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>

        {idMode ? (
          <div className="flex items-center gap-1.5 rounded-full bg-zinc-900/90 px-3 py-1.5 backdrop-blur-md border border-zinc-800">
            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${idSide === 'front' ? 'bg-white text-black shadow-md' : 'text-zinc-400'}`}>
              Front
            </span>
            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${idSide === 'back' ? 'bg-white text-black shadow-md' : 'text-zinc-400'}`}>
              Back
            </span>
          </div>
        ) : (
        <div className="flex items-center gap-1.5 rounded-full bg-zinc-900/90 px-3 py-1.5 backdrop-blur-md border border-zinc-800">
          <button
            onClick={() => setIsBatchMode(false)}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
              !isBatchMode ? 'bg-white text-black shadow-md' : 'text-zinc-400'
            }`}
          >
            Single
          </button>
          <button
            onClick={() => setIsBatchMode(true)}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-all flex items-center gap-1 ${
              isBatchMode ? 'bg-white text-black shadow-md' : 'text-zinc-400'
            }`}
          >
            <Layers className="h-3.5 w-3.5" /> Batch
          </button>
        </div>
        )}

        <button
          onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/90 border border-zinc-800 text-white backdrop-blur-md active:scale-95"
          aria-label="Switch camera"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      {/* Main Viewfinder */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Framing Guide */}
        {idMode ? (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[88%] max-w-md aspect-[1.586] border-2 border-dashed border-white/70 rounded-2xl flex flex-col justify-between p-3 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]">
              <div className="flex justify-between">
                <div className="w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
                <div className="w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
              </div>
              <div className="text-center bg-black/80 backdrop-blur-sm self-center px-4 py-1.5 rounded-full text-xs font-medium text-zinc-200 border border-zinc-700">
                {idSide === 'front' ? 'Place the FRONT of the ID inside the frame' : 'Now flip it: place the BACK inside the frame'}
              </div>
              <div className="flex justify-between">
                <div className="w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
                <div className="w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
              </div>
            </div>
          </div>
        ) : (
        <div className="absolute inset-8 pointer-events-none border-2 border-dashed border-white/60 rounded-2xl flex flex-col justify-between p-4 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
          <div className="flex justify-between">
            <div className="w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
            <div className="w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
          </div>
          <div className="text-center bg-black/80 backdrop-blur-sm self-center px-4 py-1.5 rounded-full text-xs font-medium text-zinc-200 border border-zinc-700">
            Align paper within frame
          </div>
          <div className="flex justify-between">
            <div className="w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
            <div className="w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
          </div>
        </div>
        )}

        {!isCameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black px-6 text-center">
            <Camera className="h-16 w-16 text-zinc-400 mb-4 animate-pulse" />
            <h3 className="text-lg font-bold">Camera Feed Offline</h3>
            <p className="text-sm text-zinc-400 mt-1 max-w-xs">
              Use gallery upload or native camera button below to scan paper documents.
            </p>
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={isBatchMode && !idMode}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── Shutter Controls (clearly elevated above nav bar) ── */}
      <div className="z-20 flex items-center justify-around bg-gradient-to-t from-black via-black/95 to-transparent px-6 pt-4 pb-2">
        {/* Gallery */}
        <button
          onClick={handleNativePick}
          className="flex flex-col items-center gap-1 text-zinc-400 hover:text-white active:scale-95"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800">
            <ImageIcon className="h-6 w-6 text-zinc-300" />
          </div>
          <span className="text-xs font-medium">Gallery</span>
        </button>

        {/* Shutter Button */}
        <button
          onClick={handleCapture}
          className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white text-black shadow-2xl transition-all active:scale-90 hover:bg-zinc-200"
          aria-label={idMode ? `Capture ${idSide} of ID card` : 'Capture page'}
        >
          <div className="h-14 w-14 rounded-full bg-black/10 border-2 border-black/30" />
        </button>

        {/* Finish / Batch Count Button */}
        <button
          onClick={onClose}
          className={`flex flex-col items-center gap-1 active:scale-95 transition-all ${
            capturedCount > 0 ? 'text-white font-bold' : 'text-zinc-500'
          }`}
        >
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800">
            <Check className="h-6 w-6 text-zinc-200" />
            {capturedCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] text-black font-bold ring-2 ring-black">
                {capturedCount}
              </span>
            )}
          </div>
          <span className="text-xs font-medium">{capturedCount > 0 ? 'Done' : idMode ? 'Skip' : 'Close'}</span>
        </button>
      </div>

      {/* ── Bottom Navigation Bar (Positioned safely above Android system buttons) ── */}
      <div
        className="z-20 flex items-center justify-around bg-black border-t border-zinc-900 px-6 pt-2.5"
        style={{
          paddingBottom: 'max(calc(env(safe-area-inset-bottom, 24px) + 24px), 48px)',
        }}
      >
        {/* Flashlight toggle */}
        <button
          onClick={handleTorchToggle}
          disabled={!torchSupported && !isNative}
          className={`flex flex-col items-center gap-1 transition-all active:scale-95 ${
            torchSupported || isNative ? 'text-zinc-300 hover:text-white' : 'text-zinc-600 cursor-not-allowed'
          }`}
          aria-label="Toggle flashlight"
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
              torchOn
                ? 'bg-yellow-400/20 border-yellow-400/60 text-yellow-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400'
            }`}
          >
            {torchOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
          </div>
          <span className="text-[10px] font-medium">
            {torchOn ? 'Flash On' : 'Flash'}
          </span>
        </button>

        {/* Camera mode indicator */}
        <div className="flex flex-col items-center gap-1 text-zinc-500">
          <Camera className="h-5 w-5" />
          <span className="text-[10px] font-medium">
            {facingMode === 'environment' ? 'Rear Cam' : 'Front Cam'}
          </span>
        </div>

        {/* Batch count indicator */}
        <div className="flex flex-col items-center gap-1 text-zinc-500">
          <Layers className="h-5 w-5" />
          <span className="text-[10px] font-medium">
            {capturedCount > 0 ? `${capturedCount} page${capturedCount !== 1 ? 's' : ''}` : isBatchMode ? 'Batch' : 'Single'}
          </span>
        </div>
      </div>
    </div>
  );
};
