import type { CredentialsInput, IntegrationKind, OperatorCredentialKind } from "@zibby/contracts";

/**
 * Whether a credential payload matches the kind an integration needs. Email
 * authenticates with a `password`; Slack/Jira/GitHub all carry a `token` — this
 * mirrors exactly what each channel adapter reads (`passwordOf` for email,
 * `tokenOf` for the rest), so a credential written through the API is the one the
 * adapter can actually use. A pure function so the rule has a single home and a
 * test, instead of living only inside the controller handler.
 */
export function credentialMatchesKind(kind: IntegrationKind, creds: CredentialsInput): boolean {
  if (!needsStoredCredential(kind)) return false; // nothing to store for this kind
  return kind === "email" ? "password" in creds : "token" in creds;
}

/**
 * Whether an integration of this kind keeps a secret in the credentials store.
 * GitLab does not: the `glab` CLI holds the login, so ZibbyOS stores nothing. The one
 * place every "needs credentials" check (setCredentials, the watcher, the connection
 * test, a reply, the UI) asks.
 */
export function needsStoredCredential(kind: IntegrationKind): boolean {
  return kind !== "gitlab";
}

/**
 * The credentials argument handed to an adapter whose kind stores none. Adapters
 * ignore it; it only satisfies the {@link ChannelAdapter} signature.
 */
export const NO_CREDENTIALS: CredentialsInput = { token: "-" };

/** Token prefix per operator-channel credential kind (Slack bot / app-level token). */
const OPERATOR_TOKEN_PREFIX: Record<OperatorCredentialKind, string> = {
  "slack-bot": "xoxb-",
  "slack-app": "xapp-",
};

/**
 * Whether a token is the kind the operator channel slot expects — a user token
 * (`xoxp-`) in the bot slot, or the two swapped, is refused before it is stored.
 */
export function operatorTokenMatchesKind(kind: OperatorCredentialKind, token: string): boolean {
  return token.startsWith(OPERATOR_TOKEN_PREFIX[kind]);
}
