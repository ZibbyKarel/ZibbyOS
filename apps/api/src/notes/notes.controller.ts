import { Controller } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { notesContract } from "@zibby/contracts";
import { InvalidNotePathError, NotePathNotFoundError, NotesService } from "./notes.service";

@Controller()
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @TsRestHandler(notesContract)
  handler() {
    return tsRestHandler(notesContract, {
      getNoteTree: async () => ({ status: 200, body: { paths: await this.notes.tree() } }),
      getNoteFile: ({ query }) =>
        this.file(query.path, async () => ({
          path: query.path,
          body: await this.notes.read(query.path),
        })),
      putNoteFile: ({ body }) =>
        this.file(body.path, async () => ({
          path: body.path,
          body: await this.notes.write(body.path, body.body),
        })),
      getNotePins: async () => ({ status: 200, body: await this.notes.pins() }),
      putNotePins: async ({ body }) => ({ status: 200, body: await this.notes.setPins(body) }),
    });
  }

  private async file<T>(rel: string, run: () => Promise<T>) {
    try {
      return { status: 200 as const, body: await run() };
    } catch (error) {
      if (error instanceof InvalidNotePathError)
        return { status: 422 as const, body: { message: error.message } };
      if (error instanceof NotePathNotFoundError)
        return { status: 404 as const, body: { message: `Note "${rel}" not found` } };
      throw error;
    }
  }
}
