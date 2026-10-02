import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export const isNative = Capacitor.isNativePlatform();

/**
 * Triggers light haptic feedback on Android
 */
export async function triggerHaptic() {
  if (isNative) {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {
      // Ignore if not supported
    }
  }
}

/**
 * Toggles the camera torch/flashlight on a given MediaStream.
 * Uses the MediaStreamTrack.applyConstraints 'torch' constraint.
 * Returns the new torch state (true = on).
 */
export async function toggleTorch(
  stream: MediaStream | null,
  currentTorchState: boolean
): Promise<boolean> {
  if (!stream) return false;
  const track = stream.getVideoTracks()[0];
  if (!track) return false;

  const newState = !currentTorchState;
  try {
    // @ts-expect-error: 'torch' is not in all TS MediaTrackConstraints typings yet
    await track.applyConstraints({ advanced: [{ torch: newState }] });
    return newState;
  } catch (e) {
    console.warn('Torch not supported on this device/browser:', e);
    return false;
  }
}

/**
 * Takes a photo using native Android camera or fallback
 */
export async function takeNativePhoto(): Promise<string | null> {
  try {
    const image = await Camera.getPhoto({
      quality: 95,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
    });
    if (image.base64String) {
      return `data:image/${image.format};base64,${image.base64String}`;
    }
    return null;
  } catch (err) {
    console.warn('Native camera cancelled or unavailable:', err);
    return null;
  }
}

/**
 * Picks photos from native Android gallery
 */
export async function pickNativePhoto(): Promise<string | null> {
  try {
    const image = await Camera.getPhoto({
      quality: 95,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
    });
    if (image.base64String) {
      return `data:image/${image.format};base64,${image.base64String}`;
    }
    return null;
  } catch (err) {
    console.warn('Gallery pick cancelled:', err);
    return null;
  }
}

/**
 * Shares PDF or file natively via Android share sheet or Web Share API
 */
export async function shareFile(blob: Blob, filename: string, mimeType: string = 'application/pdf') {
  await triggerHaptic();

  if (isNative) {
    try {
      // Save blob to native cache filesystem
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res.split(',')[1]);
        };
      });
      reader.readAsDataURL(blob);
      const base64Data = await base64Promise;

      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title: filename,
        url: savedFile.uri,
        dialogTitle: `Share ${filename}`,
      });
      return;
    } catch (e) {
      console.warn('Capacitor native share error:', e);
    }
  }

  // Fallback to Web Share API
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], filename, { type: mimeType });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: filename,
        });
        return;
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.warn('Web share failed:', err);
        }
      }
    }
  }

  // Direct download fallback
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
