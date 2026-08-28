import { createClient } from "@/lib/supabase/client";

export interface Position {
  id: string;
  division: string | null;
  department: string | null;
  title: string;
  channel: string | null;
  job_level: string | null;
  target_count: number;
  filled_count: number;
  stage1_note: string | null;
  stage2_note: string | null;
  offer_note: string | null;
  opened_at: string | null;
  target_close_at: string | null;
  status: "open" | "hold" | "closed";
  owner_name: string | null;
  note: string | null;
  closed_at: string | null;
  sort_key: number;
}

const s = (v: unknown) => (v == null ? "" : String(v).trim());
/** 원본 헤더가 그대로 남은 경우를 위한 한글 헤더 폴백 (정확/접두 일치만) */
function pick(row: Record<string, unknown>, ...labels: string[]): string {
  const norm = (x: string) => x.replace(/[\s()·:/_\-&]/g, "");
  const targets = labels.map(norm);
  for (const [rk, rv] of Object.entries(row)) {
    const n = norm(rk);
    if (targets.some((t) => n === t)) {
      const val = s(rv);
      if (val) return val;
    }
  }
  return "";
}

function statusFromNote(note: string): Position["status"] {
  if (/홀딩|보류|hold|대기/i.test(note)) return "hold";
  if (/종료|마감|완료|중단|취소|closed/i.test(note)) return "closed";
  return "open";
}

/** 스마트 업로드에서 넘어온 행(카테고리 매핑됨 + 원본 컬럼 보존)을 positions 로 일괄 삽입 */
export async function bulkInsertPositions(
  rows: Record<string, unknown>[],
): Promise<number> {
  const supabase = createClient();
  const payload = rows
    .map((r, i) => {
      const title = s(r.title) || pick(r, "포지션", "직무", "채용포지션", "공고");
      if (!title) return null;
      const note = s(r.note) || pick(r, "비고", "메모");
      const to = Number(s(r.target_count) || pick(r, "TO", "목표인원", "인원")) || 1;
      return {
        division: s(r.division) || pick(r, "본부") || null,
        department: s(r.department) || pick(r, "부서", "팀") || null,
        title,
        channel: s(r.channel) || pick(r, "채널", "경로") || null,
        job_level: s(r.job_level) || pick(r, "직책", "직급", "레벨") || null,
        target_count: to,
        stage1_note: s(r.stage1_note) || pick(r, "1차면접", "실무면접") || null,
        stage2_note:
          s(r.stage2_note) || pick(r, "2차최종면접", "2차면접", "최종면접", "임원면접") || null,
        offer_note: s(r.offer_note) || pick(r, "처우협상", "처우") || null,
        note: note || null,
        status: statusFromNote(note),
        opened_at: new Date().toISOString().slice(0, 10),
        sort_key: i,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  if (payload.length === 0) return 0;
  const { error } = await supabase.from("positions").insert(payload);
  if (error) throw error;
  return payload.length;
}

export async function listPositions(): Promise<Position[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("positions")
    .select("*")
    .order("division", { ascending: true, nullsFirst: false })
    .order("sort_key", { ascending: true })
    .order("opened_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Position[];
}
