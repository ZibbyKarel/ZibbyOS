import { Module } from "@nestjs/common";
import { GithubRunsReader } from "./github-runs.reader";
import { GitlabClient } from "./gitlab-client";

@Module({ providers: [GitlabClient, GithubRunsReader], exports: [GitlabClient, GithubRunsReader] })
export class GitHostModule {}
