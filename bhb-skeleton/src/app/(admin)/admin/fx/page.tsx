import { getRates, getBankDetails, getAutoReleaseDays } from "@/lib/money/fx";
import FxForm from "./FxForm";
export default async function FxPage() {
  const [rates, banks, days] = await Promise.all([getRates(), getBankDetails(), getAutoReleaseDays()]);
  return <FxForm rates={rates} banks={banks} days={days} />;
}
