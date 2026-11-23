import { Module } from "@nestjs/common";
import { dataDir } from "../shared/data-dir";
import { CanvasController } from "./canvas.controller";
import { CANVAS_DIR, CanvasStore } from "./canvas.store";

/** Default canvas dir, anchored to the data root (`ZIBBY_DATA_DIR/canvas`). */
export function resolveCanvasDir(): string {
  return process.env.CANVAS_DIR ?? dataDir("canvas");
}

/** Canvas registry. The HTTP listener that serves the pages is started from `main.ts`. */
@Module({
  controllers: [CanvasController],
  providers: [{ provide: CANVAS_DIR, useFactory: resolveCanvasDir }, CanvasStore],
  exports: [CanvasStore],
})
export class CanvasModule {}
