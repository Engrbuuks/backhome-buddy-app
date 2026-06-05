import { getUsdRate, getAutoReleaseDays } from "@/lib/money/fx";
import FxForm from "./FxForm";
export default async function FxPage() {
  const [rate, days] = await Promise.all([getUsdRate(), getAutoReleaseDays()]);
  return <FxForm rate={rate} days={days} />;
}
