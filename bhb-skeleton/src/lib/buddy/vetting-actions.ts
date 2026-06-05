"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/roles";

/** Stage-2 vetting: documents, guarantors and next of kin, completed by the
 *  buddy in their portal. Files are uploaded client-side to the private
 *  'vetting' bucket (RLS limits each buddy to their own {uid}/ folder);
 *  these actions only record the resulting paths and details. */

const DOC_FIELDS: Record<string, string> = {
  id_doc: "id_doc_path",
  utility_bill: "utility_bill_path",
  pcc: "pcc_path",
};

export async function getMyVetting() {
  const p = await getCurrentProfile();
  if (!p || p.role !== "buddy") return null;
  const db = createAdminClient();
  const { data } = await db
    .from("buddy_profiles")
    .select("id, vetting, id_doc_type, id_doc_path, utility_bill_path, pcc_path, guarantors, next_of_kin, bank_name, bank_account_number")
    .eq("id", p.id)
    .maybeSingle();
  return data;
}

export async function recordVettingDoc(_prev: unknown, formData: FormData) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "buddy") return { error: "Not authorized." };
  const kind = String(formData.get("kind") || "");
  const path = String(formData.get("path") || "").trim();
  const idDocType = String(formData.get("id_doc_type") || "").trim();
  const col = DOC_FIELDS[kind];
  if (!col) return { error: "Unknown document type." };
  if (!path.startsWith(`${p.id}/`)) return { error: "Upload failed — try again." };
  const update: Record<string, unknown> = { [col]: path };
  if (kind === "id_doc") {
    if (!["nin_slip", "voters_card", "drivers_license", "intl_passport"].includes(idDocType)) {
      return { error: "Select which ID document you uploaded." };
    }
    update.id_doc_type = idDocType;
  }
  const db = createAdminClient();
  const { error } = await db.from("buddy_profiles").update(update).eq("id", p.id);
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "vetting_doc_uploaded", detail: { kind } });
  revalidatePath("/buddy/vetting");
  return { error: "", saved: true };
}

export async function saveGuarantors(_prev: unknown, formData: FormData) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "buddy") return { error: "Not authorized." };
  const guarantors = [];
  for (const i of [1, 2]) {
    const g = {
      name: String(formData.get(`g${i}_name`) || "").slice(0, 120).trim(),
      occupation: String(formData.get(`g${i}_occupation`) || "").slice(0, 120).trim(),
      phone: String(formData.get(`g${i}_phone`) || "").slice(0, 32).trim(),
      address: String(formData.get(`g${i}_address`) || "").slice(0, 240).trim(),
      relationship: String(formData.get(`g${i}_relationship`) || "").slice(0, 80).trim(),
    };
    if (!g.name || !g.occupation || !g.phone || !g.address || !g.relationship) {
      return { error: `Complete all fields for guarantor ${i}.` };
    }
    guarantors.push(g);
  }
  if (guarantors[0].phone === guarantors[1].phone) {
    return { error: "Your two guarantors must be different people." };
  }
  const db = createAdminClient();
  const { error } = await db.from("buddy_profiles").update({ guarantors }).eq("id", p.id);
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "vetting_guarantors_saved", detail: { count: 2 } });
  revalidatePath("/buddy/vetting");
  return { error: "", saved: true };
}

export async function saveNextOfKin(_prev: unknown, formData: FormData) {
  const p = await getCurrentProfile();
  if (!p || p.role !== "buddy") return { error: "Not authorized." };
  const nok = {
    name: String(formData.get("nok_name") || "").slice(0, 120).trim(),
    relationship: String(formData.get("nok_relationship") || "").slice(0, 80).trim(),
    phone: String(formData.get("nok_phone") || "").slice(0, 32).trim(),
  };
  if (!nok.name || !nok.relationship || !nok.phone) return { error: "Complete all next-of-kin fields." };
  const db = createAdminClient();
  const { error } = await db.from("buddy_profiles").update({ next_of_kin: nok }).eq("id", p.id);
  if (error) return { error: error.message };
  await db.from("audit_log").insert({ actor_id: p.id, action: "vetting_nok_saved", detail: {} });
  revalidatePath("/buddy/vetting");
  return { error: "", saved: true };
}
