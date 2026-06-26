/**
 * Pluggable storage provider interface (Feature A.9).
 * R2 (S3-compatible) in prod; a local dev provider when creds aren't set.
 * Services depend on this, not a specific backend.
 */
export interface PresignResult {
  uploadUrl: string; // where the browser PUTs the file
  key: string; // the object key we'll record
  publicUrl: string; // where the file will be readable
  method: "PUT";
  headers?: Record<string, string>;
}

export interface StorageProvider {
  readonly key: string;
  /** Presign a direct-browser upload for a given key + content type. */
  presignUpload(key: string, contentType: string): Promise<PresignResult>;
  /** Store bytes server-side (used for resized/EXIF-stripped images). */
  putObject(key: string, body: Buffer, contentType: string): Promise<{ url: string }>;
  /** Read bytes back (dev serving / processing). */
  getObject(key: string): Promise<{ body: Buffer; contentType: string } | null>;
  /** Delete an object. */
  deleteObject(key: string): Promise<void>;
  /** Public URL for a stored key. */
  publicUrl(key: string): string;
}

export const STORAGE_CONFIGURED = Boolean(
  process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
);
