import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rotateSessionVersionForUser } from "@/lib/auth/session";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  await rotateSessionVersionForUser(supabase, user.id, response);
  return response;
}
