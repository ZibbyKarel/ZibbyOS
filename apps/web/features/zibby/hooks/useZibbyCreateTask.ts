"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useChat } from "../../chat/ChatContext";
import { useCreateChatHandoffMutation } from "../../chat/mutations";

export interface ZibbyCreateTask {
  /** "CREATE TASK" on a settled reply: hands the conversation up to that reply to a new task. */
  createTask: (messageId: string) => void;
  /** The message whose hand-off is being prepared (the server may be compacting), if any. */
  pendingFor: string | undefined;
}

/**
 * The "CREATE TASK" action of a settled reply → `/work/tasks/new` prefilled with a
 * hand-off of the conversation up to that reply (the server compacts a long thread and
 * references the full transcript), never just the reply's text. When the hand-off can't be
 * built the form still opens with the reply and a pointer to the conversation, so context is
 * never silently dropped. An explicit department target travels as `entry`.
 */
export function useZibbyCreateTask(): ZibbyCreateTask {
  const router = useRouter();
  const { conversationId, dockTarget, messages } = useChat();
  const handoff = useCreateChatHandoffMutation();
  const handoffMutate = handoff.mutate;

  const createTask = useCallback(
    (messageId: string) => {
      if (!conversationId) return;
      const goToNewTask = (text: string) => {
        const params = new URLSearchParams({ text });
        if (dockTarget?.kind === "department") params.set("entry", dockTarget.id);
        router.push(`/work/tasks/new?${params.toString()}` as Route);
      };
      handoffMutate(
        { body: { conversationId, upToMessageId: messageId } },
        {
          onSuccess: (res) => {
            if (res.status === 200) goToNewTask(res.body.text);
          },
          onError: () => {
            const reply = messages.find((m) => m.id === messageId)?.text ?? "";
            goToNewTask(`${reply}\n\nContext: ZIBBY chat conversation ${conversationId}.`);
          },
        },
      );
    },
    [conversationId, dockTarget, handoffMutate, messages, router],
  );

  return {
    createTask,
    pendingFor: handoff.isPending ? handoff.variables?.body.upToMessageId : undefined,
  };
}
