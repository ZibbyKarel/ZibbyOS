import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ApprovalNotFoundError } from "../approvals/approvals.errors";
import { ChatGateController } from "./chat-gate.controller";
import { ChatGateService, chatGateHash } from "./chat-gate.service";
import { ChatMcpAuthGuard } from "./chat-mcp-auth.guard";
import { ChatMcpAuthService } from "./chat-mcp-auth.service";

const check = vi.fn();
const status = vi.fn();

/** HTTP e2e over a real loopback socket, like `chat-mcp.controller.test.ts`. */
describe("/api/chat/gate — ChatGateController", () => {
  let app: INestApplication;
  let baseUrl: string;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ChatGateController],
      providers: [
        { provide: ChatGateService, useValue: { check, status } },
        ChatMcpAuthService,
        ChatMcpAuthGuard,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    token = moduleRef.get(ChatMcpAuthService).bearerToken;
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    check.mockReset();
    status.mockReset();
  });

  const input = { command: "ls" };
  const body = {
    tool: "shell",
    input,
    hash: chatGateHash("shell", input),
    intents: [{ action: "overwrite" }],
  };
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  it("401s without the chat bearer, with a wrong one, and with only an operator-token header", async () => {
    const url = "/api/chat/gate?conversationId=c1";
    await request(baseUrl).post(url).send(body).expect(401);
    await request(baseUrl)
      .post(url)
      .set(bearer("x".repeat(64)))
      .send(body)
      .expect(401);
    await request(baseUrl)
      .post(url)
      .set("x-zibby-operator-token", "operator")
      .send(body)
      .expect(401);
    await request(baseUrl).get("/api/chat/gate/appr_1?conversationId=c1").expect(401);
    expect(check).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it("POST passes the conversation and body through and returns the decision", async () => {
    check.mockResolvedValue({ decision: "pending", approvalId: "appr_1" });
    const res = await request(baseUrl)
      .post("/api/chat/gate?conversationId=c1")
      .set(bearer(token))
      .send(body)
      .expect(200);
    expect(res.body).toEqual({ decision: "pending", approvalId: "appr_1" });
    expect(check).toHaveBeenCalledWith("c1", body);
  });

  it("POST rejects a bad hash with 400 and never calls the service", async () => {
    await request(baseUrl)
      .post("/api/chat/gate?conversationId=c1")
      .set(bearer(token))
      .send({ ...body, hash: "nope" })
      .expect(400);
    expect(check).not.toHaveBeenCalled();
  });

  it("GET returns the status", async () => {
    status.mockResolvedValue({ status: "approved" });
    const res = await request(baseUrl)
      .get("/api/chat/gate/appr_1?conversationId=c1")
      .set(bearer(token))
      .expect(200);
    expect(res.body).toEqual({ status: "approved" });
    expect(status).toHaveBeenCalledWith("c1", "appr_1");
  });

  it("GET 404s for another conversation's approval", async () => {
    status.mockRejectedValue(new ApprovalNotFoundError("appr_1"));
    await request(baseUrl)
      .get("/api/chat/gate/appr_1?conversationId=other")
      .set(bearer(token))
      .expect(404);
  });
});
