/**
 * Local dev storage provider (Feature A.9). Used when R2 isn't configured.
 * Stores objects under ./.uploads and serves them via /api/files/serve.
 * The presigned "upload URL" is our own server-upload endpoint (browser PUTs
 * there), so the SAME front-end flow works in dev and prod.
 */
import { promises as fs } from "fs";
import path from "path";
import type { StorageProvider, PresignResult } from "./provider";

const ROOT = path.join(process.cwd(), ".uploads");

function safePath(key: string): string {
  // Prevent path traversal; keys are app-generated but be defensive.
  const clean = key.replace(/\.\./g, "").replace(/^\/+/, "");
  return path.join(ROOT, clean);
}

export class LocalProvider implements StorageProvider {
  readonly key = "local";

  publicUrl(key: string): string {
    return `/api/files/serve?key=${encodeURIComponent(key)}`;
  }

  async presignUpload(key: string, contentType: string): Promise<PresignResult> {
    // In dev the "upload URL" is our own PUT endpoint.
    return {
      uploadUrl: `/api/files/dev-put?key=${encodeURIComponent(key)}`,
      key,
      publicUrl: this.publicUrl(key),
      method: "PUT",
      headers: { "Content-Type": contentType },
    };
  }

  async putObject(key: string, body: Buffer, _contentType: string) {
    void _contentType;
    const dest = safePath(key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, body);
    return { url: this.publicUrl(key) };
  }

  async getObject(key: string) {
    try {
      const body = await fs.readFile(safePath(key));
      const ext = path.extname(key).toLowerCase();
      const contentType =
        ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : ext === ".webp"
              ? "image/webp"
              : ext === ".pdf"
                ? "application/pdf"
                : ext === ".doc"
                  ? "application/msword"
                  : ext === ".docx"
                    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    : "application/octet-stream";
      return { body, contentType };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string) {
    try {
      await fs.unlink(safePath(key));
    } catch {
      /* already gone */
    }
  }
}
