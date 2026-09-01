import { NextResponse } from "next/server";
import {
  getMsConfig,
  graph,
  ensureFolderPath,
  getGraphToken,
} from "@/lib/ms-graph";

/**
 * 처우확인사항 엑셀을 OneDrive 아카이브 폴더에 저장.
 * 폴더 구조: {ROOT}/{본부}/{YYYY-MM-DD}_{포지션}_{이름}/처우확인사항_{포지션}_{이름}.xlsx
 * body: { division, position, candidate, fileBase64, extraFiles?: [{name, base64}] }
 */
export async function POST(req: Request) {
  const cfg = getMsConfig();
  if (!cfg) {
    return NextResponse.json(
      {
        error:
          "Microsoft 365 연동이 설정되지 않았습니다. Vercel 환경변수 MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET / MS_TARGET_USER (+ 선택 MS_ROOT_FOLDER) 를 추가하세요.",
        needsSetup: true,
      },
      { status: 501 },
    );
  }

  const b = (await req.json().catch(() => ({}))) as {
    division?: string;
    position?: string;
    candidate?: string;
    fileBase64?: string;
    extraFiles?: { name: string; base64: string }[];
  };
  if (!b.fileBase64 || !b.position || !b.candidate) {
    return NextResponse.json(
      { error: "position, candidate, fileBase64 가 필요합니다." },
      { status: 400 },
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 80);
  const division = safe(b.division || "본부미지정");
  const caseFolder = `${today}_${safe(b.position)}_${safe(b.candidate)}`;
  const fileName = `처우확인사항_${safe(b.position)}_${safe(b.candidate)}.xlsx`;

  try {
    const folderPath = await ensureFolderPath(cfg, [division, caseFolder]);

    const put = async (name: string, base64: string, ct: string) => {
      const bytes = Buffer.from(base64, "base64");
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/users/${cfg.targetUser}/drive/root:${folderPath}/${encodeURIComponent(
          name,
        )}:/content`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${await getGraphToken(cfg)}`,
            "Content-Type": ct,
          },
          body: bytes,
        },
      );
      if (!res.ok) throw new Error(`${name} 업로드 실패: ${await res.text()}`);
      return (await res.json()) as { webUrl?: string };
    };

    const main = await put(
      fileName,
      b.fileBase64,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    for (const f of b.extraFiles ?? []) {
      await put(safe(f.name), f.base64, "application/octet-stream");
    }

    // 폴더 웹링크
    const folderRes = await graph(
      cfg,
      `/users/${cfg.targetUser}/drive/root:${folderPath}`,
    );
    const folder = folderRes.ok
      ? ((await folderRes.json()) as { webUrl?: string })
      : {};

    return NextResponse.json({
      ok: true,
      fileUrl: main.webUrl ?? null,
      folderUrl: folder.webUrl ?? null,
      folderPath: `${cfg.rootFolder}/${division}/${caseFolder}`,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
