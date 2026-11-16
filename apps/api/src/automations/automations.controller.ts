import { Controller } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { type Automation, type AutomationView, automationsContract } from "@zibby/contracts";
import { requireOperatorTokenIf } from "../approvals/operator-token.guard";
import { OperatorTokenService } from "../approvals/operator-token.service";
import { makeErrorMapper } from "../shared/http/error-mapping";
import {
  AutomationConflictError,
  AutomationNotFoundError,
  AutomationsStorageService,
  InvalidAutomationIdError,
  SystemAutomationError,
} from "./automations.storage.service";
import { AutomationFireNotFoundError, AutomationFiresStore } from "./automation-fires.store";
import { SchedulerService } from "./scheduler.service";

const errors = makeErrorMapper("Automation", {
  missing: [AutomationNotFoundError, InvalidAutomationIdError],
  conflict: [AutomationConflictError],
});

const fireErrors = makeErrorMapper("Automation fire", { missing: [AutomationFireNotFoundError] });

/** A system automation can't be deleted/retargeted — map that to a 409. */
const system409 = (error: unknown) =>
  error instanceof SystemAutomationError
    ? { status: 409 as const, body: { message: error.message } }
    : undefined;

/** Implements `automationsContract` against the storage + scheduler. */
@Controller()
export class AutomationsController {
  constructor(
    private readonly storage: AutomationsStorageService,
    private readonly scheduler: SchedulerService,
    private readonly fires: AutomationFiresStore,
    private readonly tokens: OperatorTokenService,
  ) {}

  /** Setting / changing an automation's engine override is operator-only (throws 401), like an agent's. */
  private async engineGuard(
    id: string | null,
    body: { engine?: string | null; engineModel?: string | null },
    headers: Record<string, unknown>,
  ): Promise<void> {
    if (body.engine === undefined && body.engineModel === undefined) return;
    const cur: Partial<Automation> = id ? await this.storage.get(id) : {};
    // `null` clears the override — the same as an absent stored value.
    const differs = (next: string | null | undefined, stored: string | undefined) =>
      next !== undefined && (next ?? undefined) !== stored;
    requireOperatorTokenIf(
      differs(body.engine, cur.engine) || differs(body.engineModel, cur.engineModel),
      this.tokens,
      headers,
      "Changing an automation's AI engine or model",
    );
  }

  /** Response-only read model: `lastFire` is never written into the automation file. */
  private async withLastFire(automation: Automation): Promise<AutomationView> {
    const lastFire = await this.fires.latest(automation.id);
    return lastFire ? { ...automation, lastFire } : automation;
  }

  @TsRestHandler(automationsContract)
  handler() {
    return tsRestHandler(automationsContract, {
      createAutomation: async ({ body, headers }) => {
        await this.engineGuard(null, body, headers);
        return errors.created(() => this.storage.create(body));
      },

      listAutomations: async () => ({
        status: 200,
        body: await Promise.all((await this.storage.list()).map((a) => this.withLastFire(a))),
      }),

      searchAutomations: async ({ query: { q } }) => ({
        status: 200,
        body: await this.storage.search(q),
      }),

      getAutomation: ({ params: { id } }) =>
        errors.or404(id, async () => this.withLastFire(await this.storage.get(id))),

      updateAutomation: ({ params: { id }, body, headers }) =>
        errors.or404(
          id,
          async () => {
            await this.engineGuard(id, body, headers);
            return this.storage.update(id, body);
          },
          system409,
        ),

      deleteAutomation: ({ params: { id } }) =>
        errors.or404(
          id,
          async () => {
            await this.storage.delete(id);
            return { id };
          },
          system409,
        ),

      triggerAutomation: ({ params: { id } }) =>
        errors.or404(id, async () => ({ runRef: await this.scheduler.trigger(id) })),

      listAutomationFires: ({ params: { id } }) =>
        errors.or404(id, async () => {
          await this.storage.get(id);
          return this.fires.list(id);
        }),

      getAutomationFireLog: ({ params: { id, fireId }, query: { offset } }) =>
        fireErrors.or404(fireId, () => this.fires.readLog(id, fireId, offset)),
    });
  }
}
