import { useEffect, useState } from 'react';

export type AlbumPalette = { accent: string; glow: string; deep: string };

function fromHue(hue: number, saturation: number): AlbumPalette {
  const safeHue = Math.round(hue);
  const safeSaturation = Math.round(Math.min(72, Math.max(38, saturation)));
  return {
    accent: `hsl(${safeHue} ${safeSaturation}% 76%)`,
    glow: `hsl(${safeHue} ${safeSaturation}% 34% / 34%)`,
    deep: `hsl(${safeHue} ${Math.round(safeSaturation * .55)}% 14%)`,
  };
}

function hueFromHex(value: string): AlbumPalette {
  const color = value.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!color) return fromHue(36, 55);
  const [r, g, b] = color.slice(1).map(part => parseInt(part, 16) / 255);
  const high = Math.max(r, g, b);
  const low = Math.min(r, g, b);
  const delta = high - low;
  let hue = 0;
  if (delta > 0) {
    if (high === r) hue = ((g - b) / delta) % 6;
    else if (high === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
  }
  return fromHue((hue * 60 + 360) % 360, high === 0 ? 0 : delta / high * 100);
}

function paletteFromImage(image: HTMLImageElement): AlbumPalette {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 48;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas indisponível');
  context.drawImage(image, 0, 0, 48, 48);
  const pixels = context.getImageData(0, 0, 48, 48).data;
  const buckets = new Map<number, { score: number; saturation: number }>();
  for (let i = 0; i < pixels.length; i += 16) {
    const r = pixels[i] / 255, g = pixels[i + 1] / 255, b = pixels[i + 2] / 255;
    const high = Math.max(r, g, b), low = Math.min(r, g, b), delta = high - low;
    const brightness = (high + low) / 2;
    if (pixels[i + 3] < 180 || delta < .12 || brightness < .09 || brightness > .91) continue;
    let hue = 0;
    if (high === r) hue = ((g - b) / delta) % 6;
    else if (high === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    const bucket = Math.floor(((hue * 60 + 360) % 360) / 15);
    const saturation = high === 0 ? 0 : delta / high * 100;
    const old = buckets.get(bucket) || { score: 0, saturation: 0 };
    buckets.set(bucket, { score: old.score + 1 + saturation / 100, saturation: old.saturation + saturation });
  }
  const ranked = [...buckets.entries()].sort((a, b) => b[1].score - a[1].score);
  if (!ranked.length) throw new Error('Capa sem cor dominante');
  const [bucket, value] = ranked[0];
  return fromHue(bucket * 15 + 7, value.saturation / Math.max(1, value.score / 1.5));
}

export function useAlbumPalette(imageUrl: string | undefined, fallbackAccent: string): AlbumPalette {
  const [palette, setPalette] = useState(() => hueFromHex(fallbackAccent));
  useEffect(() => {
    const fallback = hueFromHex(fallbackAccent);
    setPalette(fallback);
    if (!imageUrl) return;
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (cancelled) return;
      try { setPalette(paletteFromImage(image)); } catch { setPalette(fallback); }
    };
    image.onerror = () => { if (!cancelled) setPalette(fallback); };
    image.src = imageUrl;
    return () => { cancelled = true; image.src = ''; };
  }, [imageUrl, fallbackAccent]);
  return palette;
}
