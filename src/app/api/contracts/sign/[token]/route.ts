import { NextRequest } from "next/server";
import { ok, handleError, fail } from "@/lib/api/respond";
import { publicContract, publicContractSignSchema, signPublicContract } from "@/lib/services/neyo-contract.service";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const contract = await publicContract(params.token);
    if (!contract) return fail("NOT_FOUND", "Contract not found or no longer available.", 404);
    return ok({ contract });
  } catch (error) { return handleError(error); }
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
    const body = publicContractSignSchema.parse(await req.json().catch(() => ({})));
    const contract = await signPublicContract(params.token, body, ip);
    return ok({ contract });
  } catch (error) { return handleError(error); }
}
