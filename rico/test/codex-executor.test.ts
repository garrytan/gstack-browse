import { expect, test } from "bun:test";
import {
  parseCodexSpecialistResponse,
  sanitizeCodexSpecialistResponse,
} from "../src/codex/executor";

test("parseCodexSpecialistResponse accepts raw JSON", () => {
  const parsed = parseCodexSpecialistResponse(
    '{"summary":"구체적으로 진행해볼게요.","impact":"info","artifacts":[{"kind":"report","title":"planner-report.md"}],"rawFindings":["docs/README.md 확인"]}',
  );

  expect(parsed).toMatchObject({
    summary: "구체적으로 진행해볼게요.",
    impact: "info",
    artifacts: [{ kind: "report", title: "planner-report.md" }],
  });
});

test("parseCodexSpecialistResponse extracts fenced JSON", () => {
  const parsed = parseCodexSpecialistResponse(
    '```json\n{"summary":"검증이 더 필요해요.","impact":"blocking","artifacts":[],"rawFindings":["테스트 기준 누락"]}\n```',
  );

  expect(parsed).toMatchObject({
    summary: "검증이 더 필요해요.",
    impact: "blocking",
    artifacts: [],
  });
});

test("parseCodexSpecialistResponse rejects non-json output", () => {
  expect(() => parseCodexSpecialistResponse("not-json")).toThrow(
    "Codex specialist response was not valid JSON",
  );
});

test("sanitizeCodexSpecialistResponse drops fake sandbox-limit findings after successful inspection", () => {
  const sanitized = sanitizeCodexSpecialistResponse({
    inspectedWorkspace: true,
    parsed: {
      summary: "실제 코드 기준으로 우선순위를 정리했어요.",
      impact: "info",
      artifacts: [],
      rawFindings: [
        "src/app/routes.ts를 확인했다.",
        "현재 런타임에서는 저장소 실제 파일 탐색이 제한되어 추가 근거 수집이 막혀 있다.",
      ],
    },
  });

  expect(sanitized.rawFindings).toEqual(["src/app/routes.ts를 확인했다."]);
});
