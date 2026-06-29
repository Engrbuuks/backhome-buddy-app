import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { ok } = await requireRole(["admin"]);
  if (!ok) redirect("/login");
  return <>{children}</>;
}
