# Modern Web Guidance setup

[settings.json](/.claude/settings.json) enables Google's `modern-web-guidance` plugin for this repository, as [configuration.md](/.claude/docs/configuration.md) describes, but each person installs the plugin once for each clone, and each person who works in auto mode adds an entry once on each machine:

1. In the main checkout, once it has these settings, install the plugin at project scope: `claude plugin marketplace add GoogleChrome/modern-web-guidance`, then `claude plugin install modern-web-guidance@googlechrome --scope project`, or the same with `/plugin` in a session. A plugin installed at project scope from the main checkout also loads in its worktrees, and in no other repository. Start a new session afterwards, so that the hook which turns off the CLI's telemetry has run before the plugin's commands.
2. If you work in auto mode, add this entry to `~/.claude/settings.json`, or only its string when your settings already have an `autoMode.allow` list, and check it with `claude auto-mode config`, because the classifier of auto mode reads no `autoMode` setting from this repository and can refuse the plugin's commands:

   ```json
   {
     "autoMode": {
       "allow": [
         "$defaults",
         "Running `pnpx modern-web-guidance@latest search` or `pnpx modern-web-guidance@latest retrieve` is allowed: Google's CLI prints guides of Chrome's public Modern Web Guidance for a read-only check of web code and edits no file of the repository."
       ]
     }
   }
   ```
