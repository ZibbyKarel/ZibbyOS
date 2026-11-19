"use client";

import type { ChatWidget } from "@zibby/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Checkbox, Stack, TextLink } from "@zibby/design-system";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useNow } from "../../../hooks/useNow";
import { compactAgo } from "../../../utils/time";
import { useDeleteTodoMutation } from "../../todo/mutations";
import { getTodoQueryKey, useTodoQuery } from "../../todo/queries";
import { todoTaskTitle } from "../../todo/todoTaskTitle";
import { useCreateTaskMutation } from "../../tasks/mutations";
import {
  ChatWidgetFrame,
  ChatWidgetRow,
  NEXT_LINK,
  takeRows,
  widgetStatus,
} from "./ChatWidgetFrame";
import { RunWidgetCard } from "./RunWidgetCard";

export enum TodoWidgetCardTestId {
  Root = "todo-widget-card",
  Done = "todo-widget-card-done",
  Play = "todo-widget-card-play",
  Started = "todo-widget-card-started",
}

export interface TodoWidgetCardProps {
  widget: Extract<ChatWidget, { kind: "todo" }>;
}

/** What a played note became: a live run, or a task whose run is still spawning. */
type Started = { id: string; runRef: string | undefined; taskId: string };

/**
 * `todo` — the dashboard TODO widget's notes (`useTodoQuery`, `/api/todo`) in the thread. The
 * checkbox marks a note done (it is deleted, same as the dashboard — e.g. handled in another
 * session); play creates the task from the note (`todoId` makes the server drop the note) and
 * shows the run's card right under the list.
 */
export function TodoWidgetCard({ widget }: TodoWidgetCardProps) {
  const t = useTranslations("zibbyWidgets");
  const tTodo = useTranslations("bridge.widgets.todo");
  const now = useNow(60_000);
  const qc = useQueryClient();
  const query = useTodoQuery();
  const remove = useDeleteTodoMutation();
  const createTask = useCreateTaskMutation();
  const [started, setStarted] = useState<Started[]>([]);

  const items = query.data?.items ?? [];
  const { shown, hiddenCount } = takeRows(items, widget.limit);

  const play = (id: string, text: string) =>
    createTask.mutate(
      { body: { title: todoTaskTitle(text), text, todoId: id } },
      {
        onSuccess: (res) => {
          void qc.invalidateQueries({ queryKey: getTodoQueryKey() });
          const { outcome, task } = res.body;
          setStarted((prev) => [
            ...prev,
            { id, taskId: task.id, runRef: outcome === "dispatched" ? res.body.runRef : undefined },
          ]);
        },
      },
    );

  return (
    <Stack direction="col" gap="100">
      <ChatWidgetFrame
        count={items.length}
        emptyText={t("todo.empty")}
        hiddenCount={hiddenCount}
        onRetry={() => void query.refetch()}
        rootTestId={TodoWidgetCardTestId.Root}
        status={widgetStatus({
          isPending: query.isPending,
          isError: query.isError,
          count: items.length,
        })}
        title={widget.title ?? t("todo.title")}
      >
        {shown.map((item) => (
          <ChatWidgetRow
            itemKey={item.id}
            key={item.id}
            leading={
              <Checkbox
                checked={false}
                data-testid={`${TodoWidgetCardTestId.Done}-${item.id}`}
                label={tTodo("doneLabel", { name: item.text })}
                onChange={() => remove.mutate({ params: { id: item.id } })}
                size="sm"
              />
            }
            statusLabel={compactAgo(item.createdAt, now)}
            title={todoTaskTitle(item.text)}
            tone="idle"
            trailing={
              <Button
                aria-label={tTodo("implementLabel", { name: item.text })}
                data-testid={`${TodoWidgetCardTestId.Play}-${item.id}`}
                disabled={createTask.isPending}
                icon="play"
                intent="ghost"
                onClick={() => play(item.id, item.text)}
                size="sm"
              />
            }
          />
        ))}
      </ChatWidgetFrame>
      {started.map((s) =>
        s.runRef ? (
          <RunWidgetCard key={s.id} widget={{ kind: "run", runRef: s.runRef }} />
        ) : (
          <TextLink
            data-testid={`${TodoWidgetCardTestId.Started}-${s.id}`}
            href={`/work/tasks/${s.taskId}` as Route}
            key={s.id}
            linkComponent={NEXT_LINK}
          >
            {t("todo.started")}
          </TextLink>
        ),
      )}
    </Stack>
  );
}
