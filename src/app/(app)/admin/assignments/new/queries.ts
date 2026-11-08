import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/auth/session";

export interface PhaseOption {
  id: string;
  title: string;
  phase_number: number;
  weeks: Array<{ id: string; title: string; week_number: number }>;
}

export async function getPhasesAndWeeks(): Promise<PhaseOption[]> {
  const ctx = await getSessionContext();
  if (ctx.status !== "active") return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("phases")
    .select(
      "id, title, phase_number, display_order, weeks:id(title, weeks:weeks(id, title, week_number, display_order))",
    )
    .order("display_order", { ascending: true });

  if (error || !data) return [];

  // Flatten: phases → weeks. The nested select above is awkward; fall back
  // to a separate weeks query for cleanliness.
  const { data: phasesRaw } = await supabase
    .from("phases")
    .select("id, title, phase_number, display_order")
    .order("display_order", { ascending: true });

  if (!phasesRaw) return [];

  const phaseIds = phasesRaw.map((p) => p.id);
  const { data: weeksRaw } = await supabase
    .from("weeks")
    .select("id, title, week_number, phase_id, display_order")
    .in("phase_id", phaseIds)
    .order("display_order", { ascending: true });

  const weeksByPhase = new Map<string, PhaseOption["weeks"]>();
  for (const w of weeksRaw ?? []) {
    const arr = weeksByPhase.get(w.phase_id) ?? [];
    arr.push({
      id: w.id,
      title: w.title,
      week_number: w.week_number,
    });
    weeksByPhase.set(w.phase_id, arr);
  }

  return phasesRaw.map((p) => ({
    id: p.id,
    title: p.title,
    phase_number: p.phase_number,
    weeks: weeksByPhase.get(p.id) ?? [],
  }));
}
