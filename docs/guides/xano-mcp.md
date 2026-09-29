# Connecting Claude Code to Xano (MCP)

Xano's Metadata MCP server lets Claude Code read and change the Xano backend directly: tables and rows,
schema and indexes, API endpoints, functions, tasks, triggers and branches. Setup takes about five minutes.

> **The token is a full-access credential.** Never commit it, paste it into a shared file or put it in
> `.env.example`. The steps below keep it in your personal Claude Code config (`~/.claude.json`), not in the repo.

## 1. Generate an access token
Source: [Xano MCP docs](https://docs.xano.com/building/build-with-ai/xano-mcp).

1. Open the [instance selection screen](https://app.xano.com/instance) and click the ⚙️ icon beside the
   **Social Bevy** instance (`xwpg-kuah-brlj.n7d.xano.io`).
2. Select **Metadata API & MCP Server**, then **Manage Access Tokens**.
3. Click **+ New Access Token**.
4. Name it after yourself and its purpose (for example, `claude-code-<your-name>`), pick the scopes and an
   expiration, and click **Create**. See Xano's
   [token scopes reference](https://docs.xano.com/xano-features/metadata-api/token-scopes-reference).
   - For read-only work (exploring schema and data), grant read scopes only.
   - To let Claude edit the database, grant read/write on **Database** (`workspace:database`) and
     **Content** (`workspace:content`), plus **API**, **Function** and **Task** if it should edit backend logic.
   - Leave out tenant/cluster admin, secrets, backups and deploy unless you really need them.
5. **Copy the token right away.** Xano shows it only once.

## 2. Add the server to Claude Code
The server URL is also shown in the **MCP Server** panel of the same settings page. Use the `…/stream`
URL; the `…/sse` URL is no longer served.

From the repo root:

```bash
claude mcp add --scope local --transport http xano \
  "https://xwpg-kuah-brlj.n7d.xano.io/x2/mcp/meta/mcp/stream" \
  --header "Authorization: Bearer <YOUR_TOKEN>"
```

`--scope local` saves the server for you and this project only, in `~/.claude.json`. Don't use
`--scope project`: it writes `.mcp.json` into the repo, and the token would get committed.

## 3. Verify
```bash
claude mcp get xano      # should show: Status: ✔ Connected
```
Then start a new Claude Code session (or run `/mcp` in an open one) so the Xano tools load. Try
"list the tables in the Xano workspace." The server asks for the **workspace ID** first; it's an integer
that Claude can look up with `listWorkspaces`.

## Working safely
- Ask Claude to confirm before destructive actions: dropping or truncating tables, deleting columns,
  bulk updates or deletes, or changes on the live branch.
- For risky schema changes, work on a non-live Xano branch, or take a snapshot first.
- After changing a table or endpoint, update [`docs/architecture/xano_tables.md`](../architecture/xano_tables.md)
  or [`docs/api/`](../api/) in the same PR.

## Rotating or removing the token
Tokens expire. To swap in a new one, or when you're done:

```bash
claude mcp remove xano -s local
# then repeat step 2 with the new token
```
Also revoke the old token under **Manage Access Tokens** in Xano. Revoke it right away if it was ever
pasted anywhere shared.

## Troubleshooting
| Symptom | Fix |
|---|---|
| `Failed to connect` / 401 | Token expired, revoked or copied incompletely. Generate a new one. |
| "SSE transport is not served here" | You used the `…/sse` URL. Switch to `…/stream`. |
| Connected, but no Xano tools in the session | Restart Claude Code or run `/mcp`. |
| 405/404 on an `…/api:xxxx` URL | That's an API group's base URL, not an MCP server. Use the URL from step 2. |
