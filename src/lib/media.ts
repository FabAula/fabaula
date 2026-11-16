import { useEffect, useState } from 'react';
import { supabase } from './supabase';

const BUCKET = 'media';
const cache = new Map<string, { url: string; exp: number }>();

/** Redueix la imatge (per defecte a 1280 px, JPEG ≈150-300 KB) abans de pujar-la */
export async function compress(file: Blob, max = 1280, type: 'image/jpeg' | 'image/png' = 'image/jpeg'): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d')!;
  if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), type, 0.82));
}

/** Puja una imatge a una ruta concreta. Retorna 'ok', 'exists' o llança error */
export async function uploadToPath(path: string, file: Blob, max = 1280): Promise<'ok' | 'exists'> {
  const blob = await compress(file, max);
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  if (error) {
    if (/exists|duplicate/i.test(error.message)) return 'exists';
    throw error;
  }
  cache.delete(path);
  return 'ok';
}

/** Logotip: quadrat petit en PNG per conservar la transparència */
export async function uploadLogo(schoolId: string, file: File): Promise<string> {
  const blob = await compress(file, 256, 'image/png');
  const path = `${schoolId}/brand/${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/png' });
  if (error) throw error;
  return path;
}

export async function uploadMedia(schoolId: string, folder: string, file: File): Promise<string> {
  const isImage = file.type.startsWith('image/');
  const blob = await compress(file);
  const ext = isImage ? 'jpg' : (file.name.split('.').pop() ?? 'bin').toLowerCase();
  const path = `${schoolId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: isImage ? 'image/jpeg' : file.type,
  });
  if (error) throw error;
  return path;
}

export async function mediaUrl(path: string): Promise<string | null> {
  const hit = cache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (!data) return null;
  cache.set(path, { url: data.signedUrl, exp: Date.now() + 3500_000 });
  return data.signedUrl;
}

export function useMediaUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (path) mediaUrl(path).then((u) => alive && setUrl(u)); else setUrl(null);
    return () => { alive = false; };
  }, [path]);
  return url;
}
