import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { ErrorSchema } from "../common.schema";
import {
  ChatConversationRefSchema,
  ChatConversationSummarySchema,
  ChatGateCheckBodySchema,
  ChatGateDecisionSchema,
  ChatGateStatusSchema,
  ChatHandoffBodySchema,
  ChatHandoffSchema,
  ChatTranscriptSchema,
  RenameChatConversationBodySchema,
  SendChatMessageBodySchema,
  SendChatMessageResultSchema,
} from "./chat.schema";

const c = initContract();

const conversationPathParams = z.object({ conversationId: z.string() });

/**
 * Chat (chat-first conversational layer). `POST /chat/messages` appends the
 * operator's turn, kicks off a streaming `claude` session turn, and returns
 * immediately with `{ conversationId, turnId }`; the assistant's tokens arrive
 * out-of-band on the SSE endpoint `GET /api/chat/stream` (a raw `@Sse()`, not
 * part of this ts-rest router). `GET /chat/transcript` is a pure read of the
 * append-only transcript. Omitting `conversationId` targets the single active
 * conversation (MVP is one ongoing thread).
 */
export const chatContract = c.router(
  {
    sendMessage: {
      method: "POST",
      path: "/chat/messages",
      body: SendChatMessageBodySchema,
      responses: { 201: SendChatMessageResultSchema, 404: ErrorSchema },
      summary: "Append a turn and start a streaming assistant response",
    },
    getTranscript: {
      method: "GET",
      path: "/chat/transcript",
      query: z.object({ conversationId: z.string().optional() }),
      responses: { 200: ChatTranscriptSchema },
      summary: "Read the conversation transcript (pure read)",
    },
    listConversations: {
      method: "GET",
      path: "/chat/conversations",
      /** `q` — case-insensitive substring match over the title and every message's text; adds `snippet`. */
      query: z.object({ q: z.string().optional() }),
      responses: { 200: z.array(ChatConversationSummarySchema) },
      summary: "List past conversations, newest first (pure read)",
    },
    renameConversation: {
      method: "PATCH",
      path: "/chat/conversations/:conversationId",
      pathParams: conversationPathParams,
      body: RenameChatConversationBodySchema,
      responses: { 200: ChatConversationSummarySchema, 404: ErrorSchema },
      summary: "Rename a conversation (custom title wins over the derived one)",
    },
    deleteConversation: {
      method: "DELETE",
      path: "/chat/conversations/:conversationId",
      pathParams: conversationPathParams,
      body: c.noBody(),
      responses: { 200: ChatConversationRefSchema, 404: ErrorSchema },
      summary: "Soft-delete a conversation (moved to the chat trash, restorable)",
    },
    clearConversation: {
      method: "POST",
      path: "/chat/conversations/:conversationId/clear",
      pathParams: conversationPathParams,
      body: c.noBody(),
      responses: { 200: ChatConversationRefSchema, 404: ErrorSchema },
      summary: "Snapshot a conversation to the trash, then empty it in place",
    },
    restoreConversation: {
      method: "POST",
      path: "/chat/conversations/:conversationId/restore",
      pathParams: conversationPathParams,
      body: c.noBody(),
      responses: { 200: ChatConversationSummarySchema, 404: ErrorSchema },
      summary: "Restore a conversation from the trash (after a delete or a clear)",
    },
    createHandoff: {
      method: "POST",
      path: "/chat/handoff",
      body: ChatHandoffBodySchema,
      responses: { 200: ChatHandoffSchema, 404: ErrorSchema },
      summary: "Build a task description that carries the conversation's context",
    },
  },
  { pathPrefix: "/api", strictStatusCodes: true },
);
export type ChatContract = typeof chatContract;

const gateQuery = z.object({ conversationId: z.string().min(1) });

/**
 * The inline chat approval gate, called by the opencode chat plugin (not the web app) with the
 * per-boot chat bearer from loopback only. `POST /chat/gate` decides a classified tool call
 * (allow / deny / pending + a card in the chat); `GET /chat/gate/:approvalId` is the plugin's poll
 * for the operator's decision. Separate from `chatContract`: not part of the web client surface.
 */
export const chatGateContract = c.router(
  {
    check: {
      method: "POST",
      path: "/chat/gate",
      query: gateQuery,
      body: ChatGateCheckBodySchema,
      responses: { 200: ChatGateDecisionSchema, 401: ErrorSchema },
      summary: "Decide a classified chat tool call (allow, deny, or hold for an inline approval)",
    },
    status: {
      method: "GET",
      path: "/chat/gate/:approvalId",
      pathParams: z.object({ approvalId: z.string() }),
      query: gateQuery,
      responses: { 200: ChatGateStatusSchema, 401: ErrorSchema, 404: ErrorSchema },
      summary: "Poll the decision of a held chat tool call",
    },
  },
  { pathPrefix: "/api", strictStatusCodes: true },
);
export type ChatGateContract = typeof chatGateContract;
