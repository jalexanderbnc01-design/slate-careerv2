import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../firebase/client";

export interface PortfolioAsset {
  id: string;
  filename: string;
  storagePath: string;
  downloadUrl: string;
  size: number;
  contentType: string;
  uploadedAt: string;
}

const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function makePortfolioAssetId(): string {
  return `asset_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function sanitizePortfolioFilename(raw: string): string {
  const cleaned = String(raw || "asset")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 160);
  return cleaned || "asset";
}

export async function uploadPortfolioFile(
  uid: string,
  file: File
): Promise<PortfolioAsset> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `File exceeds the ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB upload limit.`
    );
  }
  const safeName = sanitizePortfolioFilename(file.name);
  const assetId = makePortfolioAssetId();
  const storagePath = `users/${uid}/portfolio/${assetId}_${safeName}`;
  const objectRef = ref(storage, storagePath);
  await uploadBytes(objectRef, file, {
    contentType: file.type || "application/octet-stream",
  });
  const downloadUrl = await getDownloadURL(objectRef);
  return {
    id: assetId,
    filename: safeName,
    storagePath,
    downloadUrl,
    size: file.size,
    contentType: file.type || "application/octet-stream",
    uploadedAt: new Date().toISOString(),
  };
}

export async function deletePortfolioAsset(asset: PortfolioAsset): Promise<void> {
  try {
    await deleteObject(ref(storage, asset.storagePath));
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || "";
    if (code !== "storage/object-not-found") {
      throw err;
    }
  }
}
