"use server";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/roles";
import { runAutoRelease } from "@/lib/money/auto-release";

export async function runAutoReleaseNow() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "admin") return { error: "Not authorized.", released: 0 };
  const { released } = await runAutoRelease();
  revalidatePath("/admin/payouts");
  return { error: "", released };
}
