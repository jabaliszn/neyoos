import { redirect } from "next/navigation";
import { isOperatingSystemKey } from "@/lib/core/operating-systems";

export const dynamic = "force-dynamic";

export default function OsLoginPage({ params }: { params: { os: string } }) {
  const os = isOperatingSystemKey(params.os) ? params.os : "school";
  redirect(`/login?os=${os}`);
}
