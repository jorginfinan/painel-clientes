import { createClient } from "@/lib/supabase/server";
import { getUsuarioById, type Usuario } from "@/lib/db";

// Usuário logado (via Supabase Auth) com seu profile, ou null.
export async function getUsuarioAtual(): Promise<Usuario | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const u = await getUsuarioById(user.id);
  return u ?? null;
}
