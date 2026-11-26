import { Module } from "@nestjs/common";
import { dataDir } from "../shared/data-dir";
import { GoalStateStore } from "./goal-state.store";
import { GoalsController } from "./goals.controller";
import { GOALS_DIR, GoalsStorageService } from "./goals.storage.service";

/** Default goals dir: `dataDir("goals")`, overridable with `GOALS_DIR`. */
export function resolveGoalsDir(): string {
  return process.env.GOALS_DIR ?? dataDir("goals");
}

@Module({
  controllers: [GoalsController],
  providers: [
    { provide: GOALS_DIR, useFactory: resolveGoalsDir },
    GoalsStorageService,
    GoalStateStore,
  ],
  exports: [GoalsStorageService, GoalStateStore],
})
export class GoalsModule {}
