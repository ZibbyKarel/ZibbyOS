import { Module } from "@nestjs/common";
import { recipesDir, zibbyHome } from "../shared/data-dir";
import { ConnectedServicesController } from "./connected-services.controller";
import {
  BROWSER_PROFILES_DIR,
  CHROME_LAUNCHER,
  CONNECTED_SERVICES_DIR,
  ConnectedServicesService,
  MCP_SERVERS_DIR,
  openChrome,
} from "./connected-services.service";

@Module({
  controllers: [ConnectedServicesController],
  providers: [
    {
      provide: CONNECTED_SERVICES_DIR,
      useFactory: () => process.env.CONNECTED_SERVICES_DIR ?? recipesDir("connected-services"),
    },
    {
      provide: BROWSER_PROFILES_DIR,
      useFactory: () => process.env.BROWSER_PROFILES_DIR ?? `${zibbyHome()}/browser-profiles`,
    },
    {
      provide: MCP_SERVERS_DIR,
      useFactory: () => process.env.MCP_DIR ?? recipesDir("mcp-servers"),
    },
    { provide: CHROME_LAUNCHER, useValue: openChrome },
    ConnectedServicesService,
  ],
})
export class ConnectedServicesModule {}
