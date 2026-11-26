import { Controller } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { loopsContract } from "@zibby/contracts";
import { makeErrorMapper } from "../shared/http/error-mapping";
import {
  InvalidLoopError,
  InvalidLoopIdError,
  LoopConflictError,
  LoopNotFoundError,
} from "./loops.errors";
import { LoopsStorageService } from "./loops.storage.service";

const errors = makeErrorMapper("Loop", {
  missing: [LoopNotFoundError, InvalidLoopIdError],
  conflict: [LoopConflictError],
});

/** A structurally-invalid loop definition (e.g. bad verifier spec) maps to a 422. */
const invalid = (error: unknown) =>
  error instanceof InvalidLoopError
    ? ({ status: 422, body: { message: error.message } } as const)
    : undefined;

/** Implements `loopsContract` against the file-backed storage service. */
@Controller()
export class LoopsController {
  constructor(private readonly storage: LoopsStorageService) {}

  @TsRestHandler(loopsContract)
  handler() {
    return tsRestHandler(loopsContract, {
      createLoop: ({ body }) => errors.created(() => this.storage.create(body), invalid),

      listLoops: async () => ({ status: 200, body: await this.storage.list() }),

      getLoop: ({ params: { id } }) => errors.or404(id, () => this.storage.get(id)),

      updateLoop: ({ params: { id }, body }) =>
        errors.or404(id, () => this.storage.update(id, body), invalid),

      deleteLoop: ({ params: { id } }) =>
        errors.or404(id, async () => {
          await this.storage.delete(id);
          return { id };
        }),
    });
  }
}
