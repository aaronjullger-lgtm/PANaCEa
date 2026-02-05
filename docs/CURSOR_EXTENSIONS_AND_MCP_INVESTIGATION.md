# Cursor Extensions & MCP Servers Investigation

**Purpose:** Document installed extensions and MCP servers and how to use them to increase efficiency and support more complex work in this project.

---

## 1. MCP Servers (Discovered)

MCP (Model Context Protocol) servers are configured at the Cursor project level. Tool descriptors are provided at runtime; this doc summarizes what is available and how to use it.

### 1.1 cursor-ide-browser

**Server:** `cursor-ide-browser`  
**Role:** Browser automation for frontend development and testing.

**Use when:**
- Verifying UI after code changes (navigate to localhost, snapshot, click, type).
- Checking deployed or staging URLs.
- Running lightweight UI checks without spinning up full Playwright from the repo.

**Important workflow:**
1. **Order:** `browser_navigate` → `browser_lock` → (interactions) → `browser_unlock`. You cannot lock before a tab exists.
2. **Before interacting:** Use `browser_tabs` (action `"list"`) and `browser_snapshot` to get element refs.
3. **Waiting:** Prefer short waits (1–3s) plus `browser_snapshot` to see when the page is ready instead of one long wait.

**Limitations:**
- Iframe content is not accessible.
- Native dialogs: use `browser_handle_dialog` before the action that triggers them (e.g. `accept: false` for Cancel).
- For nested scroll, use `browser_scroll` with `scrollIntoView: true` before clicking.

**Efficiency tip:** When you change a route or component, you can ask the agent to “open the app and confirm X works” and it can use this MCP to do it.

---

### 1.2 user-GitKraken (GitKraken)

**Server:** `user-GitKraken`  
**Role:** Git/GitKraken integration.

**Discovered capability:**
- **`code_review_branch`** (prompt/tool): Generates a code review branch name from context. Input: `branch_name` (branch to review).

**Use when:**
- Naming or referencing branches for code review.
- Keeping branch naming consistent with team conventions.

**Efficiency tip:** When starting or describing a code review, invoke this tool so branch names are consistent and descriptive.

---

### 1.3 MCP configuration in this repo

- **File:** `.vscode/mcp.json`  
- **Content:** Only `utcpBridge` with `args: ["/Users/aaronullger"]`.  
- **Note:** No other MCP servers are defined in-repo; cursor-ide-browser and GitKraken are enabled at the Cursor/IDE level. A separate Code-Mode MCP (UTCP `call_tool_chain`) is documented in `docs/MCP_CODE_MODE_FIX.md` for Cline/UTCP; that is independent of this project’s `.vscode/mcp.json`.

---

## 2. Extensions

### 2.1 Current state

- **Project:** No `.vscode/extensions.json` (no workspace-recommended extensions).
- **Discovery:** Installed extensions are managed by Cursor/VS Code at the user level, so the exact list is not visible from the repo. The list below is a recommendation for this stack.

### 2.2 Recommended workspace extensions (add `.vscode/extensions.json`)

Adding a `recommendations` block improves onboarding and consistency. Suggested entries for PANaCEa (React 19, Vite, Tailwind, Prisma, Cloudflare, TypeScript):

| Extension ID | Purpose |
|--------------|--------|
| `dbaeumer.vscode-eslint` | ESLint integration; enforce project lint rules. |
| `esbenp.prettier-vscode` | Format on save; align with project Prettier config. |
| `bradlc.vscode-tailwindcss` | Tailwind IntelliSense, class ordering, preview. |
| `Prisma.prisma` | Schema highlighting, format, Go to definition for `schema.prisma`. |
| `ms-playwright.playwright` | Run/debug Playwright tests from the editor. |
| `ZixuanChen.vitest-explorer` | Run Vitest tests from the sidebar. |
| `usernamehw.errorlens` | Inline display of errors/warnings (optional). |

**Optional for Cloudflare / edge:**
- Wrangler or Cloudflare official extension if you use dashboard/debug from the IDE.

Creating `.vscode/extensions.json` with these (and any you already use) will prompt new contributors to install them and helps the AI assume a consistent tool set.

---

## 3. How this increases efficiency and complexity

### 3.1 Efficiency

- **Browser (cursor-ide-browser):** Reduces back-and-forth (“run the app and check X”) by letting the agent drive the browser and report results.
- **GitKraken:** Standardizes branch naming for reviews and reduces ad hoc naming.
- **Extensions:** Linting, formatting, Prisma, and test runners in the IDE catch issues earlier and make refactors safer.

### 3.2 Complexity

- **Richer E2E-style checks:** Combine code changes with “verify in browser via MCP” for quick visual/flow checks without writing a full Playwright test every time.
- **Structured workflows:** Use MCP tools in sequence (e.g. implement → build → open in browser → snapshot/click) in one flow.
- **Consistency:** Recommended extensions + rules (e.g. `.cursor/rules`) keep formatting, lint, and patterns aligned so the model can assume a single style and tool set.

---

## 4. Summary

| Item | Status | Action |
|------|--------|--------|
| **cursor-ide-browser** | Enabled | Use for in-chat browser checks and light UI verification. |
| **user-GitKraken** | Enabled | Use `code_review_branch` for review branch naming. |
| **Project MCP config** | `.vscode/mcp.json` has only utcpBridge | No change required for current servers. |
| **Workspace extensions** | None recommended in repo | Add `.vscode/extensions.json` with ESLint, Prettier, Tailwind, Prisma, Playwright, Vitest. |

Adding `.vscode/extensions.json` is the main concrete improvement at the repo level; the MCP servers are already available for more efficient and complex workflows when the agent uses them by default (see `.cursor/rules/autonomous-behavior.mdc`).
