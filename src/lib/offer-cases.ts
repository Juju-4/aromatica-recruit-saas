import { createClient } from "@/lib/supabase/client";
import type { CareerRow } from "@/lib/career-calc";

export interface OfferPayload {
  // 기본정보
  candidate_name?: string;
  applied_field?: string; // 지원부문
  birth_year?: string;
  gender?: string;
  last_company?: string;
  prev_salary?: number; // 직전연봉(원)
  desired_join_date?: string;
  total_career_label?: string; // "6년 11개월"
  // 제안
  proposed_grade?: string; // 제안직급
  proposed_base?: number; // 제안연봉(기본급)
  proposed_monthly?: number; // 제안월급
  labor_cost_total?: number; // 인건비(식대·복지 포함)
  // 현재직장 산정내역 (월)
  cur_base?: number;
  cur_meal?: number;
  cur_job_allowance?: number;
  cur_overtime?: number;
  cur_fixed_bonus?: number;
}

export interface OfferCase {
  id: string;
  division: string | null;
  department: string | null;
  position: string;
  candidate_name: string;
  status: "draft" | "review" | "sent" | "archived";
  payload: OfferPayload;
  career_rows: CareerRow[];
  interviewer_notes: string | null;
  jd_text: string | null;
  jd_url: string | null;
  opinion_draft: string | null;
  onedrive_folder: string | null;
  onedrive_file_url: string | null;
  teams_message: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  archived_at: string | null;
}

export async function listOfferCases(): Promise<OfferCase[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("offer_cases")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OfferCase[];
}

export async function createOfferCase(input: {
  division?: string;
  department?: string;
  position: string;
  candidate_name: string;
  created_by_name?: string | null;
}): Promise<OfferCase> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("offer_cases")
    .insert({
      division: input.division || null,
      department: input.department || null,
      position: input.position,
      candidate_name: input.candidate_name,
      created_by: user?.id ?? null,
      created_by_name: input.created_by_name ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as OfferCase;
}

export async function updateOfferCase(
  id: string,
  patch: Partial<
    Pick<
      OfferCase,
      | "division"
      | "department"
      | "position"
      | "candidate_name"
      | "status"
      | "payload"
      | "career_rows"
      | "interviewer_notes"
      | "jd_text"
      | "jd_url"
      | "opinion_draft"
      | "onedrive_folder"
      | "onedrive_file_url"
      | "teams_message"
    >
  > & { sent_at?: string; archived_at?: string },
) {
  const supabase = createClient();
  const { error } = await supabase.from("offer_cases").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteOfferCase(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("offer_cases").delete().eq("id", id);
  if (error) throw error;
}

export interface ReferenceCheck {
  id: string;
  offer_case_id: string | null;
  referee_name: string | null;
  referee_email: string;
  relationship: string | null;
  status: "draft" | "drafted" | "sent" | "received";
  outlook_draft_id: string | null;
  note: string | null;
  created_by_name: string | null;
  created_at: string;
}

export async function listReferenceChecks(caseId: string): Promise<ReferenceCheck[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reference_checks")
    .select("*")
    .eq("offer_case_id", caseId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ReferenceCheck[];
}

export async function addReferenceCheck(input: {
  offer_case_id: string;
  referee_name?: string;
  referee_email: string;
  relationship?: string;
  created_by_name?: string | null;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reference_checks")
    .insert({
      offer_case_id: input.offer_case_id,
      referee_name: input.referee_name || null,
      referee_email: input.referee_email,
      relationship: input.relationship || null,
      created_by_name: input.created_by_name ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ReferenceCheck;
}

export async function updateReferenceCheck(
  id: string,
  patch: Partial<Pick<ReferenceCheck, "status" | "outlook_draft_id" | "note">>,
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("reference_checks")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteReferenceCheck(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("reference_checks").delete().eq("id", id);
  if (error) throw error;
}
