import { Controller } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { canvasContract } from "@zibby/contracts";
import { CanvasStore } from "./canvas.store";

/** Implements `canvasContract` — READ-ONLY metadata; the html is served by the canvas listener. */
@Controller()
export class CanvasController {
  constructor(private readonly canvases: CanvasStore) {}

  @TsRestHandler(canvasContract)
  handler() {
    return tsRestHandler(canvasContract, {
      getCanvas: async ({ params: { id } }) => {
        const meta = await this.canvases.get(id);
        return meta
          ? { status: 200, body: meta }
          : { status: 404, body: { message: `Canvas "${id}" not found` } };
      },
    });
  }
}
