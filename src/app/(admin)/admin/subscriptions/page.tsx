import { listSubscriptions } from "@/lib/subscriptions/actions";
import { listClients } from "@/lib/admin/clients-actions";
import { getRequestFormOptions } from "@/lib/requests/actions";
import SubscriptionsAdmin from "./SubscriptionsAdmin";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const [subs, clients, options] = await Promise.all([
    listSubscriptions(),
    listClients(1, 500),
    getRequestFormOptions(),
  ]);

  return (
    <SubscriptionsAdmin
      rows={subs.rows}
      mrrNgn={subs.mrrNgn}
      migrationMissing={subs.migrationMissing}
      clients={clients.rows}
      services={options.services}
      regions={options.regions}
    />
  );
}
