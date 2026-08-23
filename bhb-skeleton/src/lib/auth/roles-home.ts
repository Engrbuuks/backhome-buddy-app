import type { UserRole } from "@/types/db";

/** Where each role lands after login / confirmation. Plain module (NOT a
 *  "use server" file) so it can be imported by pages and server actions alike. */
export const HOME_FOR: Record<UserRole, string> = {
  client: "/client/dashboard",
  buddy: "/buddy/dashboard",
  admin: "/admin/dashboard",
};
