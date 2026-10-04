import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { homeRouteForRole } from "@/lib/authorization";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(homeRouteForRole(user.rol));
}
