import { notFound } from "next/navigation";
import { publicContract } from "@/lib/services/neyo-contract.service";
import { PublicContractSignClient } from "@/components/contracts/public-contract-sign-client";

export const dynamic = "force-dynamic";

export default async function ContractSignPage({ params }: { params: { token: string } }) {
  const contract = await publicContract(params.token);
  if (!contract) notFound();
  return <PublicContractSignClient contract={JSON.parse(JSON.stringify(contract))} />;
}
