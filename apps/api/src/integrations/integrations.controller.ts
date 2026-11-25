import { Controller, Inject } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import type { Integration } from "@zibby/contracts";
import { integrationsContract } from "@zibby/contracts";
import { CompaniesStorageService } from "../companies/companies.storage.service";
import { ProjectsStorageService } from "../projects/projects.storage.service";
import { ResolvedProjectService } from "../projects/resolved-project.service";
import { makeErrorMapper } from "../shared/http/error-mapping";
import { CONNECTION_TESTER, type ConnectionTester } from "./connection-tester";
import { NO_CREDENTIALS, credentialMatchesKind, needsStoredCredential } from "./credential-kind";
import { CredentialsStore } from "./credentials.store";
import {
  IntegrationConflictError,
  IntegrationNotFoundError,
  IntegrationsStorageService,
  InvalidIntegrationIdError,
} from "./integrations.storage.service";

const errors = makeErrorMapper("Integration", {
  missing: [IntegrationNotFoundError, InvalidIntegrationIdError],
  conflict: [IntegrationConflictError],
});

const unprocessable = (message: string) => ({ status: 422 as const, body: { message } });

/**
 * Implements `integrationsContract`. Credentials live in a separate, gitignored
 * store and are write-only: the entity returned to clients carries only the
 * computed `hasCredentials`, never the secret. `kind` is immutable (a config whose
 * kind disagrees → 422). Deleting an integration cascades its credentials file.
 */
@Controller()
export class IntegrationsController {
  constructor(
    private readonly storage: IntegrationsStorageService,
    private readonly credentials: CredentialsStore,
    private readonly projects: ProjectsStorageService,
    private readonly companies: CompaniesStorageService,
    private readonly resolved: ResolvedProjectService,
    @Inject(CONNECTION_TESTER) private readonly tester: ConnectionTester,
  ) {}

  /** Layer the read-time `hasCredentials` onto an entity for the wire. */
  private async withCredentialState(integration: Integration): Promise<Integration> {
    // A kind with no stored secret (gitlab: the glab login) is always "credentialled".
    const hasCredentials =
      !needsStoredCredential(integration.kind) || (await this.credentials.has(integration.id));
    return { ...integration, hasCredentials };
  }

  /** FK integrity: a company-owned account must name an existing company (else 422). */
  private async assertCompanyExists(companyId: string): Promise<void> {
    const exists = (await this.companies.list()).some((c) => c.id === companyId);
    if (!exists) throw new UnknownCompanyViolation();
  }

  @TsRestHandler(integrationsContract)
  handler() {
    return tsRestHandler(integrationsContract, {
      createIntegration: ({ body }) => {
        if (body.kind !== body.config.kind) {
          return Promise.resolve(unprocessable("config kind must match the integration kind"));
        }
        return errors.created(
          async () => {
            // No `companyId` = the operator's personal account.
            if (body.companyId) await this.assertCompanyExists(body.companyId);
            return this.withCredentialState(await this.storage.create(body));
          },
          (error) =>
            error instanceof UnknownCompanyViolation ? unprocessable("unknown company") : undefined,
        );
      },

      listIntegrations: async ({ query }) => {
        // Scoped by a project id, this returns the accounts that SERVE the project
        // (its company's, then the operator's project-scoped ones) via the resolver.
        // An unknown project id lists nothing, not a 500.
        if (query.projectId) {
          const project = await this.projects.get(query.projectId).catch(() => null);
          const scoped = project ? await this.resolved.resolveIntegrations(project) : [];
          return {
            status: 200,
            body: await Promise.all(scoped.map((i) => this.withCredentialState(i))),
          };
        }
        const all = await this.storage.list();
        return {
          status: 200,
          body: await Promise.all(all.map((i) => this.withCredentialState(i))),
        };
      },

      getIntegration: ({ params: { id } }) =>
        errors.or404(id, async () => this.withCredentialState(await this.storage.get(id))),

      updateIntegration: ({ params: { id }, body }) =>
        errors.or404(
          id,
          async () => {
            const existing = await this.storage.get(id);
            if (body.config && body.config.kind !== existing.kind) {
              throw new ImmutableKindViolation();
            }
            if (body.companyId) await this.assertCompanyExists(body.companyId);
            // Same rule as the create body's refinement: an account stores no repo.
            const { config } = body;
            if (
              (config?.kind === "github" || config?.kind === "gitlab") &&
              config.repo !== undefined
            ) {
              throw new StoredRepoViolation(config.kind);
            }
            return this.withCredentialState(await this.storage.update(id, body));
          },
          (error) =>
            error instanceof ImmutableKindViolation
              ? unprocessable("kind is immutable")
              : error instanceof StoredRepoViolation
                ? unprocessable(error.message)
                : error instanceof UnknownCompanyViolation
                  ? unprocessable("unknown company")
                  : undefined,
        ),

      deleteIntegration: ({ params: { id } }) =>
        errors.or404(id, async () => {
          await this.storage.get(id); // 404 before any side effect
          await this.storage.delete(id);
          await this.credentials.remove(id);
          return { id };
        }),

      setCredentials: ({ params: { id }, body }) =>
        errors.or404(
          id,
          async () => {
            const existing = await this.storage.get(id);
            if (!credentialMatchesKind(existing.kind, body)) {
              throw new CredentialKindViolation();
            }
            await this.credentials.write(id, body);
            return this.withCredentialState(existing);
          },
          (error) =>
            error instanceof CredentialKindViolation
              ? unprocessable("credential kind does not match the integration kind")
              : undefined,
        ),

      deleteCredentials: ({ params: { id } }) =>
        errors.or404(id, async () => {
          const existing = await this.storage.get(id);
          await this.credentials.remove(id);
          return this.withCredentialState(existing);
        }),

      testIntegration: ({ params: { id } }) =>
        errors.or404(
          id,
          async () => {
            const integration = await this.storage.get(id);
            const creds = needsStoredCredential(integration.kind)
              ? await this.credentials.read(id)
              : NO_CREDENTIALS;
            if (!creds) throw new NoCredentialsViolation();
            const result = await this.tester.test(integration, creds);
            await this.storage.markSync(
              id,
              result.ok
                ? {
                    status: "connected",
                    lastSyncAt: new Date().toISOString(),
                    lastError: undefined,
                    tokenExpiresAt: result.tokenExpiresAt,
                  }
                : { status: "error", lastError: result.detail },
            );
            return result;
          },
          (error) =>
            error instanceof NoCredentialsViolation
              ? { status: 409 as const, body: { message: "no credentials configured" } }
              : undefined,
        ),
    });
  }
}

/** Internal control-flow markers mapped to 422/409 by the handler's `extra` callbacks. */
class ImmutableKindViolation extends Error {}
class StoredRepoViolation extends Error {
  constructor(kind: string) {
    super(`a ${kind} account has no repo — set the project's gitRemote instead`);
  }
}
class CredentialKindViolation extends Error {}
class NoCredentialsViolation extends Error {}
class UnknownCompanyViolation extends Error {}
