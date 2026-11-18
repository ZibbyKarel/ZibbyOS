import { Module } from "@nestjs/common";
import { GitlabClient } from "./gitlab-client";

@Module({ providers: [GitlabClient], exports: [GitlabClient] })
export class GitHostModule {}
