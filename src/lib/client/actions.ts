"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";

export async function listRecipients() {
  const supabase = createClient();
  const { data } = await supabase.from("saved_recipients").select("*").order("created_at", { ascending: false });
  return data ?? [];
}
export async function saveRecipient(input: { id?: string; name: string; phone?: string; address?: string; notes?: string }) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "client") return { error: "Not authorized." };
  if (!input.name?.trim()) return { error: "Name is required." };
  const supabase = createClient();
  const row = { client_id: p.id, name: input.name.trim(), phone: input.phone ?? "", address: input.address ?? "", notes: input.notes ?? "" };
  const { error } = input.id
    ? await supabase.from("saved_recipients").update(row).eq("id", input.id)
    : await supabase.from("saved_recipients").insert(row);
  if (error) return { error: error.message };
  revalidatePath("/client/recipients");
  return { error: "" };
}
export async function deleteRecipient(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("saved_recipients").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/client/recipients");
  return { error: "" };
}
export async function updateMyProfile(_prev: unknown, formData: FormData) {
  const p = await getCurrentProfile();
  if (!p) return { error: "Not signed in." };
  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({
    full_name: String(formData.get("full_name") || ""),
    phone: String(formData.get("phone") || ""),
  }).eq("id", p.id);
  if (error) return { error: error.message };
  revalidatePath("/client/profile"); revalidatePath("/buddy/profile");
  return { error: "", saved: true };
}
export async function listMyPayments() {
  const supabase = createClient();
  const { data } = await supabase.from("payments")
    .select("id, amount_ngn, status, provider, funds_held, created_at, requests(title, fx_rate)")
    .order("created_at", { ascending: false });
  return data ?? [];
}
