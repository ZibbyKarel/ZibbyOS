"use client";

import { useState } from "react";
import { AgentEditor } from "./components/AgentEditor";
import { newAgentDraft } from "./agentDraft";

/** The `/workforce/agents/new` page: the detail layout over a blank, pre-filled draft. */
export function NewScreen() {
  const [draft] = useState(() => newAgentDraft());
  return <AgentEditor isNew agent={draft} />;
}
