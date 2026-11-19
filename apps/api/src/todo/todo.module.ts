import { Module } from "@nestjs/common";
import { VAULT_DIR } from "../memory/vault.service";
import { dataDir, resolveVaultDir } from "../shared/data-dir";
import { TodoController } from "./todo.controller";
import { ProjectTodoService } from "./project-todo.service";
import { TODO_FILE, TodoStore } from "./todo.store";

export function resolveTodoFile(): string {
  return process.env.TODO_FILE ?? dataDir("todo", "items.json");
}

@Module({
  controllers: [TodoController],
  providers: [
    { provide: TODO_FILE, useFactory: resolveTodoFile },
    // Same vault dir MemoryModule resolves; re-provided so this module stays a leaf.
    { provide: VAULT_DIR, useFactory: resolveVaultDir },
    TodoStore,
    ProjectTodoService,
  ],
  exports: [TodoStore, ProjectTodoService],
})
export class TodoModule {}
