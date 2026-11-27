import { Controller } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { connectedServicesContract } from "@zibby/contracts";
import { makeErrorMapper } from "../shared/http/error-mapping";
import {
  ConnectedServiceExistsError,
  ConnectedServiceNotFoundError,
  ConnectedServicesService,
} from "./connected-services.service";

const errors = makeErrorMapper("Connected service", {
  missing: [ConnectedServiceNotFoundError],
  conflict: [ConnectedServiceExistsError],
});

@Controller()
export class ConnectedServicesController {
  constructor(private readonly services: ConnectedServicesService) {}

  @TsRestHandler(connectedServicesContract)
  handler() {
    return tsRestHandler(connectedServicesContract, {
      listConnectedServices: async () => ({ status: 200, body: await this.services.list() }),
      createConnectedService: ({ body }) => errors.created(() => this.services.create(body)),
      updateConnectedService: ({ params: { id }, body }) =>
        errors.or404(id, () => this.services.update(id, body)),
      deleteConnectedService: async ({ params: { id } }) => {
        try {
          await this.services.remove(id);
          return { status: 204, body: undefined };
        } catch (error) {
          if (errors.isMissing(error)) return errors.notFound(id);
          throw error;
        }
      },
      connectService: ({ params: { id } }) => errors.or404(id, () => this.services.connect(id)),
    });
  }
}
