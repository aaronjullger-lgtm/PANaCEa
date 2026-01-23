# Code-Mode MCP Server Configuration Fix

## Problem
The `.utcp_config.json` file contains invalid keys that don't match the UtcpClientConfig Zod schema, causing connection failures.

## Invalid Keys (Current Configuration)
- ❌ `manualRegistrations`
- ❌ `progressiveDiscovery`
- ❌ `security`

## Valid Keys (Correct Schema)
- ✅ `load_variables_from`
- ✅ `manual_call_templates`
- ✅ `post_processing`
- ✅ `tool_repository`
- ✅ `tool_search_strategy`

## Solution

### Step 1: Update Configuration File
Open `/Users/aaronullger/.utcp_config.json` in a text editor and replace its contents with one of the following:

#### Option A: Minimal Configuration (Recommended)
```json
{}
```

#### Option B: Full Configuration Template
```json
{
  "load_variables_from": [
    {
      "variable_loader_type": "dotenv",
      "env_file_path": "/Users/aaronullger/GitHub/StudyPANaCEa/.env"
    }
  ],
  "manual_call_templates": [],
  "post_processing": [],
  "tool_repository": {
    "tool_repository_type": "in_memory"
  },
  "tool_search_strategy": {
    "tool_search_strategy_type": "tag_and_description_word_match"
  }
}
```

### Step 2: Restart VS Code/Cline
After updating the configuration file, completely restart VS Code and Cline.

### Step 3: Verify Connection
Once restarted, the Code-Mode MCP server should connect successfully and provide the `call_tool_chain` tool for executing TypeScript code with access to all available tools.

## Server Configuration
The server is already configured in `cline_mcp_settings.json`:
```json
{
  "github.com/universal-tool-calling-protocol/code-mode": {
    "autoApprove": ["call_tool_chain"],
    "disabled": false,
    "timeout": 60,
    "command": "npx",
    "args": ["-y", "@utcp/code-mode-mcp"],
    "env": {
      "UTCP_CONFIG_FILE": "/Users/aaronullger/.utcp_config.json"
    },
    "type": "stdio"
  }
}
```

## Next Steps
After completing steps 1-2 above, let me know and I'll test the server by using the `call_tool_chain` tool to demonstrate its capabilities.
