import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { verifyDocument } from "@/lib/services/document.service";
import { VerifyClient } from "./verify-client";

export const dynamic = "force-dynamic";

/**
 * Public document verification page (A.10). Reached by scanning a receipt QR.
 * No authentication — anyone can confirm a document is genuine.
 */
export default async function VerifyPage({
  params,
}: {
  params: { code: string };
}) {
  const result = await verifyDocument(params.code);

  return (
    <div className="flex min-h-screen items-center justify-center bg-warm-100 px-4 dark:bg-navy-950">
      <div className="w-full max-w-md rounded-2xl border border-navy-100 bg-white p-8 text-center shadow-card dark:border-navy-800 dark:bg-navy-900">
        <div className="mb-4 flex items-center justify-center gap-1.5 text-navy-400">
          <ShieldCheck className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            NEYO Document Check
          </span>
        </div>

        {result ? (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
              <CheckCircle2 className="h-9 w-9 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="mt-5 text-lg font-semibold text-navy-900 dark:text-navy-50">
              Genuine document
            </h1>
            <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
              Issued by <strong>{result.schoolName}</strong>
            </p>
            <div className="mt-5 rounded-xl bg-navy-50 p-4 text-left text-sm dark:bg-navy-800">
              <p className="text-navy-700 dark:text-navy-200">{result.summary}</p>
              <p className="mt-2 text-xs text-navy-400 dark:text-navy-500">
                Issued{" "}
                {new Date(result.issuedAt).toLocaleDateString("en-KE", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            {/* Instant M-Pesa Fee Payment panel for scanned Student IDs (G.10 + G.13 integration) */}
            {result.docType === "student_id" && (
              <VerifyClient verifyCode={params.code} />
            )}
          </>
        ) : (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
              <XCircle className="h-9 w-9 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="mt-5 text-lg font-semibold text-navy-900 dark:text-navy-50">
              Document not found
            </h1>
            <p className="mt-1 text-sm text-navy-500 dark:text-navy-400">
              This code doesn&apos;t match any document we issued. It may be
              mistyped or the document may be forged.
            </p>
          </>
        )}

        <p className="mt-6 text-xs text-navy-400 dark:text-navy-600">
          Powered by NEYO
        </p>
      </div>
    </div>
  );
}
