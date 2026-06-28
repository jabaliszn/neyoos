"use client";

import * as React from "react";
import { Paperclip, Loader2, X, FileText, Camera } from "lucide-react";
import { useToast } from "@/components/ui/toast";

export interface UploadedFile {
  id: string;
  url: string;
  fileName: string;
  contentType?: string;
  encrypted?: boolean;
  encryptionMode?: string | null;
}

/**
 * Reusable encrypted upload control (A.9 + I.56 Storage Vault).
 *
 * IMPORTANT: this no longer does direct browser-to-storage presigned uploads.
 * It posts the file to NEYO first, so the server can encrypt the bytes with the
 * tenant key before any external provider receives the object.
 */
export function FileUpload({
  category = "attachment",
  accept = "image/*,application/pdf",
  onUploaded,
  label = "Attach",
  capture,
}: {
  category?: string;
  accept?: string;
  onUploaded: (file: UploadedFile) => void;
  label?: string;
  /** Set false to suppress mobile camera capture for image upload surfaces. */
  capture?: "user" | "environment" | false;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const canCapturePhoto = accept.split(",").some((part) => part.trim().startsWith("image/"));
  const captureValue = capture === false || !canCapturePhoto ? undefined : (capture ?? "environment");
  const buttonLabel = canCapturePhoto ? `${label} / take photo` : label;

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("category", category);

      const res = await fetch("/api/files/encrypted", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!json.ok) {
        toast({ title: json.error?.message || "Encrypted upload failed.", tone: "error" });
        return;
      }
      onUploaded(json.data);
    } catch {
      toast({ title: "Network problem during encrypted upload.", tone: "error" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={captureValue}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label={buttonLabel}
        title={buttonLabel}
        className="flex h-11 w-11 items-center justify-center rounded-full text-navy-500 transition-colors hover:bg-navy-100 disabled:opacity-50 dark:text-navy-300 dark:hover:bg-navy-800"
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : canCapturePhoto ? (
          <Camera className="h-5 w-5" />
        ) : (
          <Paperclip className="h-5 w-5" />
        )}
      </button>
    </>
  );
}

/** Small chip showing a staged attachment with a remove button. */
export function AttachmentChip({
  file,
  onRemove,
}: {
  file: UploadedFile;
  onRemove: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-navy-200 bg-navy-50 px-3 py-1 text-xs text-navy-700 dark:border-navy-700 dark:bg-navy-800 dark:text-navy-200">
      <FileText className="h-3.5 w-3.5" />
      <span className="max-w-[12rem] truncate">{file.fileName}</span>
      {file.encrypted ? <span className="rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] font-bold text-green-700">encrypted</span> : null}
      <button onClick={onRemove} aria-label="Remove" className="text-navy-400 hover:text-red-500">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
