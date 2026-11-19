import { Module } from "@nestjs/common";
import { VAULT_DIR } from "../memory/vault.service";
import { dataDir, resolveVaultDir } from "../shared/data-dir";
import { NotesController } from "./notes.controller";
import { NOTE_PINS_FILE, NotesService } from "./notes.service";

/** Path-based vault notes + pinned set for the bridge "Plachty" widget. */
@Module({
  controllers: [NotesController],
  providers: [
    { provide: VAULT_DIR, useFactory: resolveVaultDir },
    {
      provide: NOTE_PINS_FILE,
      useFactory: () => process.env.NOTE_PINS_FILE ?? dataDir("note-pins.json"),
    },
    NotesService,
  ],
})
export class NotesModule {}
