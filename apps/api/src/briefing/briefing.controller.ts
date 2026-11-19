import { Controller } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { type DayOverview, briefingContract } from "@zibby/contracts";
import { BriefingService } from "./briefing.service";
import { DayOverviewError, DayOverviewService } from "./day-overview.service";

/** Implements `briefingContract`: a pure GET and a persisting POST /generate. */
@Controller()
export class BriefingController {
  constructor(
    private readonly briefing: BriefingService,
    private readonly day: DayOverviewService,
  ) {}

  @TsRestHandler(briefingContract)
  handler() {
    return tsRestHandler(briefingContract, {
      getBriefing: async () => ({ status: 200, body: await this.briefing.assemble() }),
      generateBriefing: async () => ({ status: 201, body: await this.briefing.generate() }),
      getDayOverview: () => this.dayOverview(() => this.day.current()),
      refreshDayOverview: () => this.dayOverview(() => this.day.refresh()),
    });
  }

  private async dayOverview(run: () => Promise<DayOverview>) {
    try {
      return { status: 200 as const, body: await run() };
    } catch (error) {
      if (error instanceof DayOverviewError)
        return { status: 503 as const, body: { message: error.message } };
      throw error;
    }
  }
}
