import { type HostCliLink, hostCli } from "../inbox/host-cli";

/** The injected system-prompt note for a project hosted on GitLab (recipes still say `gh`). */
export function gitlabHostNote(link: Extract<HostCliLink, { kind: "gitlab" }>): string {
  const cli = hostCli(link);
  return [
    "## Git host (GitLab)",
    "",
    `This project is hosted on GitLab at ${link.host} (${link.repo}), not GitHub. Wherever instructions say \`gh\`, use \`glab\` instead and read "PR" as merge request.`,
    `- View / diff / checkout: \`${cli.prView(1)}\`, \`${cli.prDiff(1)}\`, \`${cli.prCheckout(1)}\``,
    `- Open one: \`glab mr create -R ${link.host}/${link.repo}\``,
    `- CI: \`${cli.checks(1)}\`, job log \`${cli.failedLog}\``,
    `- Anything else: \`glab api --hostname ${link.host} projects/<url-encoded ${link.repo}>/…\``,
    "- Always pass the host and project path to `-R`; never run `gh` here.",
    "- Any `glab` write goes through the approval gate. Never merge: merging stays with the operator.",
  ].join("\n");
}
