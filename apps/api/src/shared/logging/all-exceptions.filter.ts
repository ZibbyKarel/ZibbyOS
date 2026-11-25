import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Injectable,
  Optional,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ActivityLogService } from "../../activity/activity-log.service";
import { LoggerService, type ScopedLogger } from "./logger.service";
import { TraceContextService } from "./trace-context.service";

/**
 * Catches everything that escapes a handler and logs it with the request's trace
 * id — the other half of "what it returned": the error path. Known errors that
 * ts-rest already maps to typed 4xx responses are returned as values and never
 * reach here, so this fires only for thrown {@link HttpException}s and genuinely
 * unexpected failures.
 *
 * It preserves the existing client contract: an `HttpException` keeps its status
 * and body; anything else becomes a generic 500 (no internal detail leaked). The
 * trace id is added to the response body too, so a user can quote it. A 5xx logs
 * at `error` with the stack; a 4xx logs at `warn`.
 */
@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log: ScopedLogger;

  constructor(
    logger: LoggerService,
    private readonly trace: TraceContextService,
    @Optional() private readonly activity?: ActivityLogService,
  ) {
    this.log = logger.child("Exception");
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : 500;
    const traceId = this.trace.getTraceId();

    const level = status >= 500 ? "error" : "warn";
    this.log[level](`✗ ${req.method} ${req.originalUrl || req.url} ${status}`, {
      err: exception instanceof Error ? exception.message : String(exception),
      ...(level === "error" && exception instanceof Error ? { stack: exception.stack } : {}),
    });

    // Same request scope as `traceId` above, so the entry's `traceId` is the one in the body.
    // ponytail: a polled GET that keeps returning 500 writes one entry per poll; dedupe if noisy.
    if (status >= 500) {
      const message = exception instanceof Error ? exception.message : String(exception);
      void this.activity?.record({
        kind: "api-error",
        summary: `✗ ${req.method} ${req.path} ${status} — ${message.slice(0, 200)}`,
        refs: {
          status: String(status),
          request: `${req.method} ${req.path}`,
          ...(exception instanceof Error && exception.stack ? { stack: exception.stack } : {}),
        },
      });
    }

    const base = isHttp
      ? exception.getResponse()
      : { statusCode: 500, message: "Internal server error" };
    const body =
      typeof base === "string" ? { statusCode: status, message: base } : { ...(base as object) };

    res.status(status).json({ ...body, ...(traceId ? { traceId } : {}) });
  }
}
