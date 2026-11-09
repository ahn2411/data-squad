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
  const { data: phases, error: phasesError } = await supabase
    .from("phases")
    .select("id, title, phase_number, display_order")
    .order("display_order", { ascending: true });

  if (phasesError) throw new Error("Could not load curriculum phases.");
  if (!phases?.length) return [];

  const phaseIds = phases.map((p) => p.id);
  const { data: weeks, error: weeksError } = await supabase
    .from("weeks")
    .select("id, title, week_number, phase_id, display_order")
    .in("phase_id", phaseIds)
    .order("display_order", { ascending: true });
  if (weeksError) throw new Error("Could not load curriculum weeks.");

  const weeksByPhase = new Map<string, PhaseOption["weeks"]>();
  for (const w of weeks ?? []) {
    const arr = weeksByPhase.get(w.phase_id) ?? [];
    arr.push({
      id: w.id,
      title: w.title,
      week_number: w.week_number,
    });
    weeksByPhase.set(w.phase_id, arr);
  }

  return phases.map((p) => ({
    id: p.id,
    title: p.title,
    phase_number: p.phase_number,
    weeks: weeksByPhase.get(p.id) ?? [],
  }));
}
