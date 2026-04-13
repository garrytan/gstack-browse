import { expect, test } from "bun:test";
import {
  buildApprovalText,
  buildCaptainFinalText,
  buildCaptainProgressText,
  buildCaptainStartText,
  buildGovernorFinalText,
  buildImpactNarration,
  buildRoutingText,
  sanitizeIncomingSlackText,
} from "../src/slack/message-style";

test("sanitizeIncomingSlackText strips ChatGPT send footers from Slack text", () => {
  expect(
    sanitizeIncomingSlackText("온보딩 개선\n*다음을 사용하여 보냄* ChatGPT"),
  ).toBe("온보딩 개선");
  expect(
    sanitizeIncomingSlackText("온보딩 개선\n*Sent using* ChatGPT"),
  ).toBe("온보딩 개선");
});

test("message style helpers produce human-sounding Slack copy without bracket prefixes", () => {
  expect(buildRoutingText("mypetroutine")).toBe(
    "🧭 총괄 라우팅\n- 프로젝트: #mypetroutine\n- 상태: 프로젝트 채널에서 바로 이어가요.",
  );
  expect(buildCaptainStartText("온보딩 개선", ["planner", "customer-voice"], {
    selectedRoles: ["planner", "customer-voice"],
    nextAction: "목표 문장과 완료 기준을 먼저 고정한다.",
    blockedReason: null,
    status: "active",
    taskGraph: [
      {
        id: "task-1",
        role: "planner",
        title: "목표 문장과 완료 기준 정리",
        dependsOn: [],
      },
      {
        id: "task-2",
        role: "customer-voice",
        title: "사용자 가치와 기대 결과 점검",
        dependsOn: ["task-1"],
      },
    ],
  })).toBe(
    "📝 캡틴 계획\n- 요청: 온보딩 개선\n- 배정:\n  • 기획: 목표 문장과 완료 기준 정리\n  • 고객 관점: 사용자 가치와 기대 결과 점검\n- 다음 액션: 목표 문장과 완료 기준을 먼저 고정한다.",
  );
  expect(buildCaptainProgressText("온보딩 개선")).toBe(
    "🔄 캡틴 진행\n- 요청: 온보딩 개선\n- 상태: 계획 정리 중\n- 다음 액션: 바로 실행 가능한 한 줄 계획으로 묶고 있어요.",
  );
  expect(
    buildCaptainProgressText("온보딩 개선", [
      { role: "qa", level: "blocking", message: "온보딩 흐름에서 회귀가 보여요. 배포 전에 막아야 해요." },
      { role: "planner", level: "info", message: "범위를 한 번 더 줄이면 돼요." },
    ]),
  ).toBe(
    "⛔ 캡틴 진행\n- 요청: 온보딩 개선\n- 기준 역할: QA\n- 판정: 차단\n- 핵심 결론: 온보딩 흐름에서 회귀가 보여요.\n- 참고: 기획 의견까지 함께 보고 있어요.",
  );
  expect(
    buildCaptainFinalText({
      finalState: "awaiting_human_approval",
      impacts: [
        {
          role: "frontend",
          level: "info",
          message: "메인 랜딩과 /ai-employee 사이 동선을 연결했어요.",
          changedFiles: ["src/app/App.tsx"],
          verificationNotes: ["npm test -- --run src/app/App.aiEmployeeRoute.test.tsx"],
        },
        {
          role: "qa",
          level: "approval_needed",
          message: "실서버 회귀 확인은 사람 판단이 한 번 더 필요해요.",
          changedFiles: [],
          verificationNotes: [],
        },
      ],
      nextAction: "QA 기준으로 실환경 재검증 여부를 결정한다.",
    }),
  ).toBe(
    "🟡 캡틴 마감\n- 상태: 결정 필요\n- 핵심 결론: 실서버 회귀 확인은 사람 판단이 한 번 더 필요해요.\n- 실제 변경: src/app/App.tsx\n- 검증: npm test -- --run src/app/App.aiEmployeeRoute.test.tsx\n- 남은 조치: QA 기준으로 실환경 재검증 여부를 결정한다.",
  );
  expect(
    buildGovernorFinalText({
      projectId: "sherpalabs",
      finalState: "awaiting_human_approval",
      leadSummary: "실서버 회귀 확인은 사람 판단이 한 번 더 필요해요.",
      changedFiles: ["src/app/App.tsx"],
      nextAction: "QA 기준으로 실환경 재검증 여부를 결정한다.",
    }),
  ).toBe(
    "🟡 총괄 마감\n- 프로젝트: #sherpalabs\n- 상태: 결정 필요\n- 핵심 결론: 실서버 회귀 확인은 사람 판단이 한 번 더 필요해요.\n- 실제 변경: src/app/App.tsx\n- 남은 조치: QA 기준으로 실환경 재검증 여부를 결정한다.",
  );
  expect(buildApprovalText("deploy", "배포 전 최종 확인이 필요합니다.")).toContain("🛑 총괄 승인 요청");
  expect(buildImpactNarration({
    role: "qa",
    summary: "온보딩 흐름에 회귀가 보여요.",
    level: "blocking",
  })).toBe("🧪 QA\n- 판정: 차단\n- 근거: 온보딩 흐름에 회귀가 보여요.");
  expect(
    buildImpactNarration({
      role: "backend",
      summary: "`src/api/client.ts` 에서 회원가입 API 응답을 정리했어요.",
      level: "info",
      changedFiles: ["src/api/signup.ts", "src/routes/signup.ts"],
      executionMode: "write",
    }),
  ).toBe("🧱 백엔드\n- 상태: 진행 가능\n- 변경: `src/api/client.ts` 에서 회원가입 API 응답을 정리했어요.\n- 변경 파일: src/api/signup.ts, src/routes/signup.ts");
  expect(buildImpactNarration({
    role: "customer-voice",
    summary: "지금 왜 중요한지 조금 더 분명해야 해요.",
    level: "approval_needed",
  })).toBe(
    "🗣️ 고객 관점\n- 상태: 결정 필요\n- 사용자 영향: 지금 왜 중요한지 조금 더 분명해야 해요.",
  );
  expect(buildImpactNarration({
    role: "planner",
    summary: "범위를 먼저 고정할게요.",
    level: "info",
  })).toBe("🧠 기획\n- 상태: 진행 가능\n- 제안: 범위를 먼저 고정할게요.");
  expect(buildImpactNarration({
    role: "designer",
    summary: "사용 흐름을 먼저 다듬을게요.",
    level: "info",
  })).toBe("🎨 디자인\n- 상태: 진행 가능\n- UX 판단: 사용 흐름을 먼저 다듬을게요.");
  expect(buildImpactNarration({
    role: "frontend",
    summary: "화면 기준을 먼저 맞출게요.",
    level: "info",
  })).toBe("🖥️ 프론트엔드\n- 상태: 진행 가능\n- 판단: 화면 기준을 먼저 맞출게요.");
  expect(buildImpactNarration({
    role: "backend",
    summary: "데이터 경계를 먼저 정리할게요.",
    level: "info",
  })).toBe("🧱 백엔드\n- 상태: 진행 가능\n- 판단: 데이터 경계를 먼저 정리할게요.");
  expect(
    buildImpactNarration({
      role: "qa",
      summary: "첫 문장입니다. 두 번째 문장은 스레드에서 너무 길게 보이지 않게 잘려야 합니다.",
      level: "blocking",
      changedFiles: ["a.ts", "b.ts", "c.ts"],
      verificationNotes: [
        "npm test -- --run src/app/very/long/path.test.ts 에서 vitest not found 오류가 길게 이어졌습니다.",
        "추가 확인도 필요합니다.",
      ],
    }),
  ).toBe(
    "🧪 QA\n- 판정: 차단\n- 근거: 첫 문장입니다.\n- 변경 파일: a.ts, b.ts 외 1개\n- 검증: npm test -- --run src/app/very/long/path.test.ts 에서 vitest not found 오류가 길게 이어졌습니다. / ...",
  );
});
