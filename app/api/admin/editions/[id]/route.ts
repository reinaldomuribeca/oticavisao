import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// PATCH { cadastros_encerrados?: boolean, raffle_date?: string }
//   — encerra/reabre cadastros e/ou define a data do sorteio da edição.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { cadastros_encerrados?: boolean; raffle_date?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const hasLock = typeof body.cadastros_encerrados === "boolean";
  const hasDate = body.raffle_date !== undefined;
  if (!hasLock && !hasDate) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Atualiza a data do sorteio (se informada)
  if (hasDate) {
    const parsed = body.raffle_date ? new Date(body.raffle_date) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "validation", message: "Data do sorteio inválida." },
        { status: 400 },
      );
    }
    const { data, error } = await supabase.rpc("set_edition_date", {
      p_edition_id: params.id,
      p_raffle_date: parsed.toISOString(),
    });
    if (error) {
      return NextResponse.json({ error: "server", message: error.message }, { status: 500 });
    }
    if ((data as Record<string, unknown>)?.error) {
      return NextResponse.json(data, { status: 404 });
    }
  }

  // Encerra/reabre cadastros (se informado)
  if (hasLock) {
    const { data, error } = await supabase.rpc("set_registration_lock", {
      p_edition_id: params.id,
      p_locked: body.cadastros_encerrados,
    });
    if (error) {
      return NextResponse.json({ error: "server", message: error.message }, { status: 500 });
    }
    if ((data as Record<string, unknown>)?.error) {
      return NextResponse.json(data, { status: 404 });
    }
  }

  return NextResponse.json({ ok: true, edition_id: params.id });
}
