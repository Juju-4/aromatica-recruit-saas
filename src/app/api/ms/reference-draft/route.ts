import { NextResponse } from "next/server";
import { getMsConfig, graph } from "@/lib/ms-graph";

/**
 * Outlook 초안(보내지 않음) 생성 — 레퍼런스 체크 메일.
 * body: { refereeEmail, refereeName?, candidate, position, bodyText, attachmentBase64?, attachmentName? }
 */
export async function POST(req: Request) {
  const cfg = getMsConfig();
  if (!cfg) {
    return NextResponse.json(
      {
        error:
          "Microsoft 365 연동이 설정되지 않았습니다. Vercel 환경변수 MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET / MS_TARGET_USER 를 추가하세요.",
        needsSetup: true,
      },
      { status: 501 },
    );
  }

  const b = (await req.json().catch(() => ({}))) as {
    refereeEmail?: string;
    refereeName?: string;
    candidate?: string;
    position?: string;
    bodyText?: string;
    attachmentBase64?: string;
    attachmentName?: string;
  };
  if (!b.refereeEmail) {
    return NextResponse.json({ error: "refereeEmail 이 필요합니다." }, { status: 400 });
  }

  const subject = `[아로마티카] ${b.candidate ?? ""} 님 레퍼런스 체크 요청${
    b.position ? ` (${b.position})` : ""
  }`;
  const html = (b.bodyText ?? defaultBody(b))
    .split("\n")
    .map((l) => l || "&nbsp;")
    .join("<br>");

  try {
    const createRes = await graph(cfg, `/users/${cfg.targetUser}/messages`, {
      method: "POST",
      body: JSON.stringify({
        subject,
        body: { contentType: "HTML", content: html },
        toRecipients: [
          {
            emailAddress: { address: b.refereeEmail, name: b.refereeName ?? undefined },
          },
        ],
      }),
    });
    if (!createRes.ok) {
      return NextResponse.json(
        { error: `초안 생성 실패: ${await createRes.text()}` },
        { status: 502 },
      );
    }
    const msg = (await createRes.json()) as { id: string; webLink?: string };

    if (b.attachmentBase64 && b.attachmentName) {
      const attRes = await graph(
        cfg,
        `/users/${cfg.targetUser}/messages/${msg.id}/attachments`,
        {
          method: "POST",
          body: JSON.stringify({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: b.attachmentName,
            contentBytes: b.attachmentBase64,
          }),
        },
      );
      if (!attRes.ok) {
        return NextResponse.json({
          ok: true,
          draftId: msg.id,
          webLink: msg.webLink,
          warn: `첨부 실패: ${await attRes.text()}`,
        });
      }
    }

    return NextResponse.json({ ok: true, draftId: msg.id, webLink: msg.webLink });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function defaultBody(b: Record<string, unknown>): string {
  return [
    "안녕하세요, 아로마티카 인사팀입니다.",
    "",
    `${b.candidate ?? "후보자"} 님의 채용 절차 관련하여 레퍼런스 체크를 요청드립니다.`,
    "첨부된 양식을 참고하시어 회신 부탁드립니다.",
    "",
    "감사합니다.",
  ].join("\n");
}
