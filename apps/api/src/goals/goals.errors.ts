export class GoalNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Goal "${id}" not found`);
    this.name = "GoalNotFoundError";
  }
}

export class GoalConflictError extends Error {
  constructor(public readonly id: string) {
    super(`Goal "${id}" already exists`);
    this.name = "GoalConflictError";
  }
}

export class InvalidGoalIdError extends Error {
  constructor(public readonly id: string) {
    super(`Invalid goal id: "${id}"`);
    this.name = "InvalidGoalIdError";
  }
}

export class CorruptGoalFileError extends Error {
  constructor(public readonly id: string) {
    super(`Goal "${id}" is stored in a corrupt or invalid file`);
    this.name = "CorruptGoalFileError";
  }
}

/** A goal definition that fails validation (e.g. deadline together with cadence). */
export class InvalidGoalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGoalError";
  }
}

export class GoalInstanceNotFoundError extends Error {
  constructor(goalId: string, instance: string) {
    super(`Instance "${instance}" of goal "${goalId}" not found`);
    this.name = "GoalInstanceNotFoundError";
  }
}

export class GoalInstanceNotParkedError extends Error {
  constructor(goalId: string, instance: string) {
    super(`Instance "${instance}" of goal "${goalId}" is not parked`);
    this.name = "GoalInstanceNotParkedError";
  }
}
