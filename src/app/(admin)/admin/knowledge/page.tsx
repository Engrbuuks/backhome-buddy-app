import { redirect } from "next/navigation";
import { getKnowledgeForAdmin } from "@/lib/admin/knowledge-actions";
import KnowledgeEditor from "./KnowledgeEditor";

export default async function KnowledgePage() {
  const kb = await getKnowledgeForAdmin();
  if (!kb) redirect("/login");
  return <KnowledgeEditor text={kb.text} isDefault={kb.isDefault} />;
}
