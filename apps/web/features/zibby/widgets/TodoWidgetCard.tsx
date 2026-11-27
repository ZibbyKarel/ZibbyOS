"use client";

import type { ChatWidget } from "@zibby/contracts";
import { Button, Checkbox, SelectField, Stack, TextLink } from "@zibby/design-system";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useProjectsQuery } from "../../projects/queries";
import { useSetProjectTodoDoneMutation } from "../../todo/mutations";
import { useProjectTodoQuery } from "../../todo/queries";
import { todoTaskTitle } from "../../todo/todoTaskTitle";
import { useCreateTaskMutation } from "../../tasks/mutations";
import {
  ChatWidgetFrame,
  ChatWidgetRow,
  NEXT_LINK,
  takeRows,
  widgetStatus,
} from "./ChatWidgetFrame";
import { chatSelection, useOpenDetail } from "../../chat/chatDetail";
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

/** What a played item became: a live run, or a task whose run is still spawning. */
type Started = { key: number; runRef: string | undefined; taskId: string };

/** The "started" link of a task without a run yet: opens the task sheet in the overlay. */
function StartedTaskLink({
  taskId,
  label,
  testKey,
}: {
  taskId: string;
  label: string;
  testKey: string;
}) {
  const openDetail = useOpenDetail(chatSelection("task", taskId));
  return (
    <TextLink
      data-testid={`${TodoWidgetCardTestId.Started}-${testKey}`}
      href={`/work/tasks/${taskId}` as Route}
      linkComponent={NEXT_LINK}
      onClick={openDetail}
    >
      {label}
    </TextLink>
  );
}

/**
 * `todo` — the open items of a PROJECT's vault TODO.md (`useProjectTodoQuery`) in the thread.
 * The checkbox ticks the item in the file; play creates a task from its text and shows the
 * run's card right under the list. Without `widget.projectId` the card offers a project select.
 */
export function TodoWidgetCard({ widget }: TodoWidgetCardProps) {
  const t = useTranslations("zibbyWidgets");
  const tTodo = useTranslations("bridge.widgets.todo");
  const projects = useProjectsQuery();
  const [picked, setPicked] = useState("");
  const projectId = widget.projectId ?? (picked || undefined);
  const query = useProjectTodoQuery(projectId);
  const setDone = useSetProjectTodoDoneMutation();
  const createTask = useCreateTaskMutation();
  const [started, setStarted] = useState<Started[]>([]);

  const items = (query.data?.items ?? []).filter((item) => !item.done);
  const { shown, hiddenCount } = takeRows(items, widget.limit);
  const projectName = projects.data?.find((p) => p.id === projectId)?.name;

  const play = (number: number, text: string) =>
    createTask.mutate(
      { body: { title: todoTaskTitle(text), text } },
      {
        onSuccess: (res) => {
          const { outcome, task } = res.body;
          setStarted((prev) => [
            ...prev,
            {
              key: number,
              taskId: task.id,
              runRef: outcome === "dispatched" ? res.body.runRef : undefined,
            },
          ]);
        },
      },
    );

  return (
    <Stack direction="col" gap="100">
      {widget.projectId === undefined ? (
        <SelectField
          label={t("todo.projectLabel")}
          onValueChange={setPicked}
          options={(projects.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
          placeholder={t("todo.projectPlaceholder")}
          value={picked}
        />
      ) : null}
      {projectId === undefined ? null : (
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
          title={
            widget.title ?? (projectName ? `${t("todo.title")} · ${projectName}` : t("todo.title"))
          }
        >
          {shown.map((item) => (
            <ChatWidgetRow
              itemKey={String(item.number)}
              key={item.number}
              leading={
                <Checkbox
                  checked={false}
                  data-testid={`${TodoWidgetCardTestId.Done}-${item.number}`}
                  label={tTodo("doneLabel", { name: item.text })}
                  onChange={() =>
                    setDone.mutate({
                      params: { projectId, number: item.number },
                      body: { done: true },
                    })
                  }
                  size="sm"
                />
              }
              statusLabel={`#${item.number}`}
              title={todoTaskTitle(item.text)}
              tone="idle"
              trailing={
                <Button
                  aria-label={tTodo("implementLabel", { name: item.text })}
                  data-testid={`${TodoWidgetCardTestId.Play}-${item.number}`}
                  disabled={createTask.isPending}
                  icon="play"
                  intent="ghost"
                  onClick={() => play(item.number, item.text)}
                  size="sm"
                />
              }
            />
          ))}
        </ChatWidgetFrame>
      )}
      {started.map((s) =>
        s.runRef ? (
          <RunWidgetCard key={s.key} widget={{ kind: "run", runRef: s.runRef }} />
        ) : (
          <StartedTaskLink
            key={s.key}
            label={t("todo.started")}
            taskId={s.taskId}
            testKey={String(s.key)}
          />
        ),
      )}
    </Stack>
  );
}
