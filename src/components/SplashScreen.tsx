import React, { useEffect, useRef, useState } from 'react';
// Light build = SVG renderer only (smaller, fine for WebView)
import lottie from 'lottie-web/build/player/lottie_light';
import type { AnimationItem } from 'lottie-web';
import splashAnimation from '../assets/splash.json';

interface SplashScreenProps {
  /** Called after the fade-out finishes — unmount the splash here. */
  onFinish: () => void;
}

const FADE_MS = 400;
// Safety net: never let the splash block the app if the animation fails
const MAX_MS = 4500;

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);
  const finishedRef = useRef(false);

  const startExit = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setLeaving(true);
    window.setTimeout(onFinish, FADE_MS);
  };

  useEffect(() => {
    let anim: AnimationItem | undefined;
    if (containerRef.current) {
      anim = lottie.loadAnimation({
        container: containerRef.current,
        renderer: 'svg',
        loop: false,
        autoplay: true,
        animationData: splashAnimation,
        rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
      });
      // Hold the final frame briefly, then fade out
      anim.addEventListener('complete', () => window.setTimeout(startExit, 250));
    }
    const safety = window.setTimeout(startExit, MAX_MS);
    return () => {
      window.clearTimeout(safety);
      anim?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onClick={startExit}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black"
      style={{
        opacity: leaving ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      <div ref={containerRef} className="w-64 h-64" aria-hidden="true" />
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-100">Paper Scanner</h1>
      <p className="mt-1 text-xs font-medium tracking-widest text-zinc-500 uppercase">
        Scan · Enhance · Export PDF
      </p>
    </div>
  );
};
