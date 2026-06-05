import { PublicChatWidget } from "@/components/PublicChatWidget";
export const metadata = { title: "Chat — Backhome Buddy" };
export default function ChatWidgetPage() {
  return <div className="h-screen w-screen"><PublicChatWidget embedded /></div>;
}
