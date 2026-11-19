import { Controller } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { todoContract } from "@zibby/contracts";
import { ProjectTodoService } from "./project-todo.service";
import { TodoFullError, TodoStore } from "./todo.store";

@Controller()
export class TodoController {
  constructor(
    private readonly todo: TodoStore,
    private readonly projectTodo: ProjectTodoService,
  ) {}

  @TsRestHandler(todoContract)
  handler() {
    return tsRestHandler(todoContract, {
      listTodo: async () => ({ status: 200, body: { items: await this.todo.list() } }),
      createTodo: async ({ body }) => {
        try {
          return { status: 201, body: await this.todo.create(body.text) };
        } catch (error) {
          if (error instanceof TodoFullError) {
            return { status: 409, body: { message: error.message } };
          }
          throw error;
        }
      },
      listProjectTodo: async ({ params }) => ({
        status: 200,
        body: { items: await this.projectTodo.list(params.projectId) },
      }),
      setProjectTodoDone: async ({ params, body }) => {
        const item = await this.projectTodo.setDone(params.projectId, params.number, body.done);
        return item
          ? { status: 200, body: item }
          : { status: 404, body: { message: `TODO item ${params.number} not found` } };
      },
      deleteTodo: async ({ params }) =>
        (await this.todo.remove(params.id))
          ? { status: 204, body: undefined }
          : { status: 404, body: { message: `TODO note ${params.id} not found` } },
    });
  }
}
