import { Controller } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { canvasContract } from "@zibby/contracts";
import { requireOperatorTokenIf } from "../approvals/operator-token.guard";
import { OperatorTokenService } from "../approvals/operator-token.service";
import { CanvasFetchError, canvasFetch } from "./canvas-fetch";
import { CanvasStore, CanvasStoreError, codeVersionOf } from "./canvas.store";

const notFound = (id: string) => ({
  status: 404 as const,
  body: { message: `Canvas "${id}" not found` },
});

/** Implements `canvasContract`; the html itself is served by the canvas listener. */
@Controller()
export class CanvasController {
  constructor(
    private readonly canvases: CanvasStore,
    private readonly tokens: OperatorTokenService,
  ) {}

  @TsRestHandler(canvasContract)
  handler() {
    return tsRestHandler(canvasContract, {
      getCanvas: async ({ params: { id } }) => {
        const meta = await this.canvases.get(id);
        return meta ? { status: 200, body: meta } : notFound(id);
      },
      setCanvasParams: async ({ params: { id }, body }) => {
        try {
          const meta = await this.canvases.setParams(id, body.params, {
            by: "operator",
            ...(body.note ? { note: body.note } : {}),
          });
          return { status: 200, body: meta };
        } catch (e) {
          if (!(e instanceof CanvasStoreError)) throw e;
          return e.code === "not-found"
            ? { status: 404, body: { message: e.message } }
            : { status: 400, body: { message: e.message } };
        }
      },
      restoreCanvasVersion: async ({ params: { id }, body }) => {
        try {
          return { status: 200, body: await this.canvases.restore(id, body.version) };
        } catch (e) {
          if (e instanceof CanvasStoreError) return { status: 404, body: { message: e.message } };
          throw e;
        }
      },
      grantCanvasOrigin: async ({ params: { id }, body, headers }) => {
        requireOperatorTokenIf(true, this.tokens, headers, "Granting canvas network access");
        try {
          return { status: 200, body: { grants: await this.canvases.grant(id, body.origin) } };
        } catch (e) {
          if (!(e instanceof CanvasStoreError)) throw e;
          return e.code === "not-found"
            ? { status: 404, body: { message: e.message } }
            : { status: 400, body: { message: e.message } };
        }
      },
      canvasFetch: async ({ params: { id }, body }) => {
        const meta = await this.canvases.get(id);
        if (!meta) return notFound(id);
        try {
          const result = await canvasFetch(body.url, {
            allowedOrigins: codeVersionOf(meta, meta.current)?.manifest?.net ?? [],
            granted: await this.canvases.grants(id),
          });
          return { status: 200, body: result };
        } catch (e) {
          if (!(e instanceof CanvasFetchError)) throw e;
          if (e.code === "bad-gateway") return { status: 502, body: { message: e.message } };
          return { status: 403, body: { error: e.code, origin: e.origin } };
        }
      },
    });
  }
}
