/**
 * Cloudflare R2 storage provider (Feature A.9). R2 is S3-compatible, so we use
 * the AWS S3 SDK pointed at the R2 endpoint. Activates when R2_* env vars exist.
 *
 * Env:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *   R2_PUBLIC_BASE (optional public bucket/CDN base URL)
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider, PresignResult } from "./provider";

function client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

function bucket(): string {
  return process.env.R2_BUCKET!;
}

export class R2Provider implements StorageProvider {
  readonly key = "r2";

  publicUrl(key: string): string {
    const base = process.env.R2_PUBLIC_BASE;
    if (base) return `${base.replace(/\/$/, "")}/${key}`;
    // Fallback: served through our own API (works even with a private bucket).
    return `/api/files/serve?key=${encodeURIComponent(key)}`;
  }

  async presignUpload(key: string, contentType: string): Promise<PresignResult> {
    const cmd = new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(client(), cmd, { expiresIn: 300 });
    return {
      uploadUrl,
      key,
      publicUrl: this.publicUrl(key),
      method: "PUT",
      headers: { "Content-Type": contentType },
    };
  }

  async putObject(key: string, body: Buffer, contentType: string) {
    await client().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
    return { url: this.publicUrl(key) };
  }

  async getObject(key: string) {
    try {
      const res = await client().send(
        new GetObjectCommand({ Bucket: bucket(), Key: key })
      );
      const bytes = await res.Body!.transformToByteArray();
      return {
        body: Buffer.from(bytes),
        contentType: res.ContentType ?? "application/octet-stream",
      };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string) {
    await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  }
}
