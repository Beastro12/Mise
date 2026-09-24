"use client";

/** Downscale phone photos before upload (keeps requests small; Claude reads ~2000 px fine). */
export async function resizeImage(file: File, max = 2000, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // unsupported format (e.g. HEIC outside Safari): upload as-is
  }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 3_000_000 && /image\/(jpeg|png|webp)/.test(file.type)) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", quality));
}

export async function uploadFile(file: Blob, filename: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file, filename);
  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!res.ok || !json.id) throw new Error(json.error || `Upload failed (${res.status})`);
  return json.id;
}

export async function uploadImages(files: File[], onProgress?: (done: number) => void): Promise<string[]> {
  const ids: string[] = [];
  for (const f of files) {
    const blob = await resizeImage(f);
    const name = blob === f ? f.name : f.name.replace(/\.[^.]+$/, "") + ".jpg";
    ids.push(await uploadFile(blob, name));
    onProgress?.(ids.length);
  }
  return ids;
}
