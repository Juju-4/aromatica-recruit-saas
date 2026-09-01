import { NextResponse } from "next/server";

/**
 * 담당자 의견 초안 생성. ANTHROPIC_API_KEY 가 설정돼 있으면 AI로 생성,
 * 없으면 규칙 기반 구조화 초안을 반환한다.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    candidate?: string;
    position?: string;
    proposedGrade?: string;
    prevSalary?: number;
    proposedBase?: number;
    interviewerNotes?: string;
    jdText?: string;
    careerLabel?: string;
  };

  const key = process.env.ANTHROPIC_API_KEY;

  if (key) {
    try {
      const prompt = buildPrompt(body);
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 1200,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: `AI 생성 실패: ${res.status}`, fallback: ruleBased(body) },
          { status: 200 },
        );
      }
      const json = (await res.json()) as {
        content: { type: string; text: string }[];
      };
      const text = json.content?.map((c) => c.text).join("\n").trim();
      return NextResponse.json({ text, mode: "ai" });
    } catch (e) {
      return NextResponse.json({
        text: ruleBased(body),
        mode: "rule",
        warn: String(e),
      });
    }
  }

  return NextResponse.json({
    text: ruleBased(body),
    mode: "rule",
    hint: "AI 문장 생성을 켜려면 Vercel 환경변수 ANTHROPIC_API_KEY 를 추가하세요.",
  });
}

function buildPrompt(b: Record<string, unknown>): string {
  return [
    "당신은 아로마티카 인사팀 채용담당자입니다. 아래 정보를 바탕으로 '처우 확인사항' 문서에 들어갈 담당자 의견을 작성하세요.",
    "형식: 1) 후보자 강점 2) 우려/확인 필요 3) 제안 처우의 근거 4) 종합 의견. 각 항목 2~4문장. 존댓말, 담백하게.",
    "",
    `- 후보자: ${b.candidate ?? "-"}`,
    `- 포지션: ${b.position ?? "-"}`,
    `- 제안 직급: ${b.proposedGrade ?? "-"}`,
    `- 인정 경력: ${b.careerLabel ?? "-"}`,
    `- 직전 연봉(원): ${b.prevSalary ?? "-"}`,
    `- 제안 연봉 기본급(원): ${b.proposedBase ?? "-"}`,
    "",
    "[면접관 의견]",
    String(b.interviewerNotes ?? "(없음)"),
    "",
    "[채용공고 JD]",
    String(b.jdText ?? "(없음)"),
  ].join("\n");
}

function ruleBased(b: Record<string, unknown>): string {
  const notes = String(b.interviewerNotes ?? "").trim();
  const jd = String(b.jdText ?? "").trim();
  const rise =
    b.prevSalary && b.proposedBase
      ? `(직전 대비 약 ${(
          ((Number(b.proposedBase) - Number(b.prevSalary)) /
            Number(b.prevSalary)) *
          100
        ).toFixed(1)}% 조정)`
      : "";
  return [
    `1) 후보자 강점`,
    notes
      ? `면접관 의견 요지: ${notes.split(/\n+/).slice(0, 3).join(" / ")}`
      : "면접관 의견을 입력하면 이 자리에 요약됩니다.",
    "",
    `2) 우려 / 확인 필요`,
    "면접에서 제기된 보완점 및 온보딩 시 확인할 사항을 정리합니다.",
    "",
    `3) 제안 처우의 근거`,
    jd
      ? `JD 상 핵심 요구역량(${jd.split(/\n+/)[0].slice(0, 60)}…) 대비 후보자 경력 ${
          b.careerLabel ?? ""
        } 및 시장 페이밴드를 고려해 ${b.proposedGrade ?? ""} 직급 기준으로 산정 ${rise}.`
      : `후보자 경력 ${b.careerLabel ?? ""} 및 시장 페이밴드를 고려해 산정 ${rise}.`,
    "",
    `4) 종합 의견`,
    "상기 내용 참고하시어 의사결정 부탁드립니다.",
  ].join("\n");
}
