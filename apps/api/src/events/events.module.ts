import { Module } from "@nestjs/common";
import { AgentsModule } from "../agents/agents.module";
import { ApprovalsModule } from "../approvals/approvals.module";
import { AutomationsModule } from "../automations/automations.module";
import { ChannelsModule } from "../channels/channels.module";
import { LoopsModule } from "../loops/loops.module";
import { WorkflowsModule } from "../workflows/workflows.module";
import { EventsController } from "./events.controller";

/**
 * Hosts the unified `/api/events` SSE channel. It pulls the agent, workflow
 * and loop runner services, the channel events service and the automation
 * fire store from their
 * owning modules (all exported) and merges their streams into one push
 * channel for the dashboard.
 */
@Module({
  imports: [
    AgentsModule,
    ApprovalsModule,
    AutomationsModule,
    WorkflowsModule,
    LoopsModule,
    ChannelsModule,
  ],
  controllers: [EventsController],
})
export class EventsModule {}
