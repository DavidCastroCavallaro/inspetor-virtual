// Compressao no cliente: redimensiona p/ max 1024px e exporta JPEG ~80%.
// Evita enviar 4K para a API (economia de tokens/custo).
const MAX_W = 1024;
const QUALITY = 0.8;

export async function compressImage(fileOrBlob) {
  const bitmap = await createImageBitmap(fileOrBlob);
  const scale = Math.min(1, MAX_W / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', QUALITY));
  const base64 = await blobToBase64(blob);
  return {
    blob,
    base64,
    mime: 'image/jpeg',
    width: w,
    height: h,
    bytes: blob.size,
  };
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.readAsDataURL(blob);
  });
}

export function base64ToUrl(base64, mime = 'image/jpeg') {
  return `data:${mime};base64,${base64}`;
}
