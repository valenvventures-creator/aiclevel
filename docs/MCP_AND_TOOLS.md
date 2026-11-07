# MCP & Tools

## Runtime tools (customer-facing executives)
Registry: `src/config/tools/registry.ts`. Grants are per executive in `ai_executive_model_configs.tool_permissions` (database-driven, editable in Settings).

| Kind | Examples | Notes |
|---|---|---|
| internal | `search_memory`, `search_files`, `get_project`, `get_decision`, `get_organization_profile`, `calculator`, `spreadsheet_analysis`, `policy_search` | Server-side functions, tenant-scoped. **Not** MCP servers. |
| provider | `web_research`, `code_tools` | Provider-hosted (e.g. Claude web search / code execution); results treated as untrusted and cited. |
| mcp | `market_data`, `security_analysis`, `send_email`, `calendar`, `crm`, `accounting` | Available only when the org connects the integration; `external_write` tools require human approval. |

Default grants: CFO — calculator, spreadsheet analysis, files, memory, market data. CTO — web research, files, memory, code, security analysis. CLO — files, memory, policy search. (See seeds.) No executive has unrestricted access.

Current state: retrieval of memory/files/project is performed by context assembly before the model call; model-invoked tool use (tool-runner loop with per-executive tool lists and approval gates) is Phase 12.

## MCP principles
- MCP is a controlled bridge to external systems — never the store for executive identities (those live in Postgres).
- Each external integration is an adapter (`src/server/integrations/<name>`, Phase 12) behind the same tool interface; writes create `approval_requests`.
- Retrieved external content is wrapped as untrusted data.

## Development MCP (`.mcp.json`)
Project-level servers for Claude Code while building the product:
- **github** — repository, PRs, issues (token via `GITHUB_PERSONAL_ACCESS_TOKEN` env).
- **supabase** — schema inspection / migrations against a dev project (`SUPABASE_ACCESS_TOKEN`, read-only recommended).
- **playwright** — browser verification of UI changes.
Credentials come from the developer's environment; never commit tokens.
