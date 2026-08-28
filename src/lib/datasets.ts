import { createClient } from "@/lib/supabase/client";

export interface DatasetRecord {
  id: string;
  category_key: string;
  name: string;
  period_label: string | null;
  status: "ready" | "review";
  row_count: number;
  file_path: string | null;
  original_filename: string | null;
  uploaded_by_name: string | null;
  is_active: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface RowRecord {
  id: string;
  dataset_id: string;
  row_no: number;
  values: Record<string, unknown>;
  updated_at: string;
}

const CHUNK = 500;

function sanitize(name: string) {
  return name.replace(/[^\w.\-가-힣]+/g, "_").slice(0, 120);
}

export async function listDatasets(categoryKey: string): Promise<DatasetRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("datasets")
    .select("*")
    .eq("category_key", categoryKey)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DatasetRecord[];
}

export async function countByCategory(): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase.from("datasets").select("category_key");
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const r of data ?? []) {
    const k = (r as { category_key: string }).category_key;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export async function getRows(datasetId: string): Promise<RowRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("dataset_rows")
    .select("*")
    .eq("dataset_id", datasetId)
    .order("row_no", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RowRecord[];
}

export async function createDataset(opts: {
  categoryKey: string;
  name: string;
  periodLabel?: string;
  rows: Record<string, unknown>[];
  file?: File | null;
  uploadedByName?: string | null;
}): Promise<DatasetRecord> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ds, error: dsErr } = await supabase
    .from("datasets")
    .insert({
      category_key: opts.categoryKey,
      name: opts.name,
      period_label: opts.periodLabel || null,
      row_count: opts.rows.length,
      original_filename: opts.file?.name ?? null,
      uploaded_by: user?.id ?? null,
      uploaded_by_name: opts.uploadedByName ?? null,
    })
    .select()
    .single();
  if (dsErr) throw dsErr;
  const dataset = ds as DatasetRecord;

  if (opts.file) {
    const path = `${opts.categoryKey}/${dataset.id}/${sanitize(opts.file.name)}`;
    const { error: upErr } = await supabase.storage
      .from("originals")
      .upload(path, opts.file, { upsert: true });
    if (!upErr) {
      await supabase.from("datasets").update({ file_path: path }).eq("id", dataset.id);
      dataset.file_path = path;
    }
  }

  for (let i = 0; i < opts.rows.length; i += CHUNK) {
    const slice = opts.rows.slice(i, i + CHUNK).map((values, j) => ({
      dataset_id: dataset.id,
      row_no: i + j + 1,
      values,
    }));
    const { error: rowErr } = await supabase.from("dataset_rows").insert(slice);
    if (rowErr) throw rowErr;
  }

  return dataset;
}

export async function deleteDataset(datasetId: string, filePath?: string | null) {
  const supabase = createClient();
  if (filePath) {
    await supabase.storage.from("originals").remove([filePath]);
  }
  const { error } = await supabase.from("datasets").delete().eq("id", datasetId);
  if (error) throw error;
}

export async function updateDataset(
  datasetId: string,
  patch: Partial<Pick<DatasetRecord, "name" | "period_label" | "status" | "is_active" | "note">>,
) {
  const supabase = createClient();
  const { error } = await supabase.from("datasets").update(patch).eq("id", datasetId);
  if (error) throw error;
}

export async function setActive(categoryKey: string, datasetId: string) {
  const supabase = createClient();
  // 한 카테고리에서 여러 데이터셋이 active 여도 되지만, "대표"는 하나로 유지
  await supabase
    .from("datasets")
    .update({ is_active: false })
    .eq("category_key", categoryKey)
    .neq("id", datasetId);
  const { error } = await supabase
    .from("datasets")
    .update({ is_active: true })
    .eq("id", datasetId);
  if (error) throw error;
}

export async function updateRow(rowId: string, values: Record<string, unknown>) {
  const supabase = createClient();
  const { error } = await supabase
    .from("dataset_rows")
    .update({ values })
    .eq("id", rowId);
  if (error) throw error;
}

export async function addRow(datasetId: string, afterRowNo: number) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("dataset_rows")
    .insert({ dataset_id: datasetId, row_no: afterRowNo + 1, values: {} })
    .select()
    .single();
  if (error) throw error;
  await bumpRowCount(datasetId, 1);
  return data as RowRecord;
}

export async function deleteRow(rowId: string, datasetId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("dataset_rows").delete().eq("id", rowId);
  if (error) throw error;
  await bumpRowCount(datasetId, -1);
}

async function bumpRowCount(datasetId: string, delta: number) {
  const supabase = createClient();
  const { count } = await supabase
    .from("dataset_rows")
    .select("*", { count: "exact", head: true })
    .eq("dataset_id", datasetId);
  if (count != null) {
    await supabase.from("datasets").update({ row_count: count }).eq("id", datasetId);
  } else {
    void delta;
  }
}

export async function downloadOriginal(filePath: string): Promise<Blob | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from("originals").download(filePath);
  if (error) return null;
  return data;
}
