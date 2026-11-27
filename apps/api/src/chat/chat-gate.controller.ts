import { Controller, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { chatGateContract } from "@zibby/contracts";
import { ApprovalNotFoundError, InvalidApprovalIdError } from "../approvals/approvals.errors";
import { makeErrorMapper } from "../shared/http/error-mapping";
import { ChatGateService } from "./chat-gate.service";
import { ChatMcpAuthGuard } from "./chat-mcp-auth.guard";

const errors = makeErrorMapper("Approval", {
  missing: [ApprovalNotFoundError, InvalidApprovalIdError],
});

/**
 * The inline chat approval gate's HTTP surface for the opencode chat plugin. Guarded by the
 * per-boot chat bearer from loopback (NOT the operator token), so a plugin can decide and poll
 * but never approve: deciding stays on the operator-token approvals routes.
 */
@Controller()
@UseGuards(ChatMcpAuthGuard)
export class ChatGateController {
  constructor(private readonly gate: ChatGateService) {}

  @TsRestHandler(chatGateContract)
  handler() {
    return tsRestHandler(chatGateContract, {
      check: async ({ query, body }) => ({
        status: 200 as const,
        body: await this.gate.check(query.conversationId, body),
      }),
      status: ({ params: { approvalId }, query }) =>
        errors.or404(approvalId, () => this.gate.status(query.conversationId, approvalId)),
    });
  }
}
