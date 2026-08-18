import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";

export default async function Home() {
  const u = await getUsuarioAtual();
  if (!u) redirect("/login");
  if (u.role === "admin") redirect("/admin");
  redirect("/cliente");
}
