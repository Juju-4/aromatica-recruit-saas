"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getCategory } from "@/lib/data-catalog";
import { buildTemplateBlob, downloadBlob } from "@/lib/xlsx";

export function TemplateDownloadButton({
  categoryKey,
  variant = "outline",
  size = "sm",
  label,
}: {
  categoryKey: string;
  variant?: "outline" | "secondary" | "default" | "ghost";
  size?: "sm" | "default" | "xs";
  label?: string;
}) {
  const cat = getCategory(categoryKey);
  const [busy, setBusy] = useState(false);
  if (!cat) return null;

  return (
    <Button
      variant={variant}
      size={size}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const blob = await buildTemplateBlob(cat);
          downloadBlob(blob, `${cat.label} 양식.xlsx`);
        } catch (e) {
          console.error(e);
          toast.error("양식 생성에 실패했습니다.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Download />}
      {label ?? "양식 다운로드"}
    </Button>
  );
}
