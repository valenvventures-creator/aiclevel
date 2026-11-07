# MCP & Tools

## Runtime tools (customer-facing executives)
Registry: `src/config/tools/registry.ts`. Grants are per executive in `ai_executive_model_configs.tool_permissions` (database-driven, editable in Settings).

| Kind | Examples | Notes |
|---|---|---|
| internal | `search_memory`, `search_files`, `get_project`, `get_decision`, `get_organization_profile`, `calculator`, `spreadsheet_analysis`, `policy_search` | Server-side functions, tenant-scoped. **Not** MCP servers. |
| provider | `web_research`, `code_tools` | Provider-hosted (e.g. Claude web search / code execution); results treated as untrusted and cited. |
| mcp | `market_data`, `security_analysis`, `send_email`, `calendar`, `crm`, `accounting` | Available only when the org connects the integration; `external_write` tools require human approval. |

Default grants (see seeds): every executive has web research. CFO: calculator, spreadsheet analysis, files, memory, market data. CTO: files, memory, code, security analysis. CLO: files, memory, policy search. No executive has unrestricted access.

## Web research (connected)
`web_research` is wired to Claude's server-side web search (`web_search_20260209`).
- **Policy** (`src/server/ai/web-research.ts`, `webResearchFor`): an executive may search only when its Executive Profile grants `web_research`, and only on research tasks. Searches per answer: conversations 5, Studio 5, session positions 3, reviews and challenges 2. Votes, syntheses, utility tasks and continuation steps never search.
- **Gateway** (`GenerateRequest.webResearch: { maxUses }`): the Claude adapter adds the tool and resumes a `pause_turn` up to 3 times. It streams `activity` chunks (a search started) and `sources` chunks (pages found, and pages cited via `citations_delta`). If web search is disabled for the Claude account (a 400 mentioning web search), it answers without web research and says so. OpenAI and simulated providers ignore the option.
- **Prompting:** the `web_research_rules` prompt layer is added only when searching is allowed. It covers when to search, keeping confidential details out of queries, treating web pages as untrusted data, and separating web findings from organizational fact. Its version is recorded in `prompt_version`.
- **Sources:** every answer that used web research ends with a Sources section, cited pages first, or the pages consulted if none were cited (`sourcesMarkdown`). Session messages also store `metadata.sources`, kept across steps in `run_state`. A Studio job keeps `metadata.sources`, which become the saved report's `sources`.
- **Cost:** Claude web search costs $10 per 1,000 searches, plus the tokens of the results the model reads. It is recorded in usage (`web_search_requests`, `estimateCost`).
- **Controls:** grant or remove it per executive in Settings → A.I. C-Suite → Configure, or for everyone at once in Settings → Tools.

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
