import { listMySubscriptions } from "@/lib/subscriptions/actions";
import { getMyDisplay } from "@/lib/money/fx";
import MySubscriptions from "./MySubscriptions";

export const dynamic = "force-dynamic";

export default async function ClientSubscriptionsPage() {
  const [subs, display] = await Promise.all([listMySubscriptions(), getMyDisplay()]);
  return (
    <MySubscriptions
      rows={subs.rows}
      migrationMissing={subs.migrationMissing}
      currency={display.currency}
      rates={display.rates}
    />
  );
}
