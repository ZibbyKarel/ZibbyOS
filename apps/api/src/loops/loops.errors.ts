/** Raised when a loop file does not exist for the requested id. */
export class LoopNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Loop "${id}" not found`);
    this.name = "LoopNotFoundError";
  }
}

/** Raised when creating a loop whose id is already taken. */
export class LoopConflictError extends Error {
  constructor(public readonly id: string) {
    super(`Loop "${id}" already exists`);
    this.name = "LoopConflictError";
  }
}

/** Raised when an id is unsafe to use as a file name (e.g. path traversal). */
export class InvalidLoopIdError extends Error {
  constructor(public readonly id: string) {
    super(`Invalid loop id: "${id}"`);
    this.name = "InvalidLoopIdError";
  }
}

/** Raised when a loop file exists but its contents cannot be parsed/validated. */
export class CorruptLoopFileError extends Error {
  constructor(public readonly id: string) {
    super(`Loop "${id}" is stored in a corrupt or invalid file`);
    this.name = "CorruptLoopFileError";
  }
}

/** Raised when a loop definition is structurally invalid (e.g. bad verifier spec). */
export class InvalidLoopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLoopError";
  }
}

/** Raised when a loop run id is unknown — controllers map it to a 404. */
export class LoopRunNotFoundError extends Error {
  constructor(id: string) {
    super(`Loop run "${id}" not found`);
    this.name = "LoopRunNotFoundError";
  }
}

/**
 * Raised when resume-with-note targets a run that is not parked — controllers map
 * it to a 409. A running / paused-limit loop resumes only through its own machine.
 */
export class LoopRunNotParkedError extends Error {
  constructor(id: string) {
    super(`Loop run "${id}" is not parked`);
    this.name = "LoopRunNotParkedError";
  }
}

/**
 * Phase 43 — raised when {@link LoopRunnerService.stop} targets a run with no live
 * maker to kill (already terminal, parked, paused-limit, or the current iteration
 * has no dispatched maker yet) — controllers map it to a 409.
 */
export class LoopRunNotStoppableError extends Error {
  constructor(id: string) {
    super(`Loop run "${id}" is not running`);
    this.name = "LoopRunNotStoppableError";
  }
}
