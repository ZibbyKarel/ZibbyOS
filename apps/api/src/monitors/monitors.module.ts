import { MachineConfigModule } from "../machine/machine-config.module";
import { Module } from "@nestjs/common";
import { GitHostModule } from "../git-host/git-host.module";
import { GithubRunsReader } from "../git-host/github-runs.reader";
import { GitlabClient } from "../git-host/gitlab-client";
import { IntegrationsModule } from "../integrations/integrations.module";
import { ResolvedProjectModule } from "../projects/resolved-project.module";
import { dataDir } from "../shared/data-dir";
import { TasksModule } from "../tasks/tasks.module";
import { GithubCiMonitor } from "./github-ci.monitor";
import { GitlabCiMonitor } from "./gitlab-ci.monitor";
import { MonitorAdapterRegistry } from "./monitor-adapter";
import { MONITOR_EVENTS_DIR, MonitorEventStore } from "./monitor-event.store";
import { MonitorWatcherService } from "./monitor-watcher.service";
import { MonitorsController } from "./monitors.controller";
import { SentryMonitor } from "./sentry.monitor";

/** Default monitor events dir, anchored to the data root. */
export function resolveMonitorEventsDir(): string {
  return process.env.MONITOR_EVENTS_DIR ?? dataDir("monitors");
}

/**
 * CI/CD monitoring (N3). The registry ships with the GitHub Actions monitor;
 * a future source (Sentry) is one `registry.register(...)` here — the seam's
 * whole point, no watcher/runtime change. Reuses the integrations store +
 * credentials (a monitor rides the integration that owns the source) and the
 * task scheduler (an alert's investigation dispatches like any other task).
 */
@Module({
  imports: [
    GitHostModule,
    IntegrationsModule,
    MachineConfigModule,
    ResolvedProjectModule,
    TasksModule,
  ],
  controllers: [MonitorsController],
  providers: [
    { provide: MONITOR_EVENTS_DIR, useFactory: resolveMonitorEventsDir },
    MonitorEventStore,
    {
      provide: MonitorAdapterRegistry,
      inject: [GitlabClient, GithubRunsReader],
      useFactory: (gitlab: GitlabClient, runs: GithubRunsReader) => {
        const registry = new MonitorAdapterRegistry();
        registry.register(new GithubCiMonitor(fetch, runs));
        registry.register(new GitlabCiMonitor(gitlab));
        registry.register(new SentryMonitor()); // NS2 F7a — the second monitor
        return registry;
      },
    },
    MonitorWatcherService,
  ],
  exports: [MonitorEventStore, MonitorAdapterRegistry],
})
export class MonitorsModule {}
