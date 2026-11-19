import { Controller } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { autopilotContract } from "@zibby/contracts";
import { hasOperatorToken } from "../approvals/operator-token.guard";
import { OperatorTokenService } from "../approvals/operator-token.service";
import { AutopilotService, automationRaises } from "./autopilot.service";

/**
 * Implements `autopilotContract`. Not behind `OperatorTokenGuard` as a whole: only resuming
 * and raising a level need the operator token; pausing and lowering only tighten, so they are
 * open (the chat's `autopilot_off` tool pauses in-process).
 */
@Controller()
export class AutopilotController {
  constructor(
    private readonly autopilot: AutopilotService,
    private readonly tokens: OperatorTokenService,
  ) {}

  @TsRestHandler(autopilotContract)
  handler() {
    return tsRestHandler(autopilotContract, {
      getAutopilot: async () => ({ status: 200, body: await this.autopilot.status() }),

      setAutopilot: async ({ body: { paused, automation }, headers }) => {
        const operator = hasOperatorToken(this.tokens, headers);
        // Pausing and lowering only tighten, so they are open (the chat's `autopilot_off` too).
        // Resuming and raising any cell (manual < semi < auto) need the operator token (Law 3).
        const resumes = paused === false && this.autopilot.isPaused();
        const raises = !!automation && automationRaises(this.autopilot.automation(), automation);
        if ((resumes || raises) && !operator) {
          return {
            status: 401,
            body: {
              message: "Resuming ZIBBY or raising an autonomy level requires the operator token.",
            },
          };
        }
        return { status: 200, body: await this.autopilot.set({ paused, automation }, "operator") };
      },
    });
  }
}
