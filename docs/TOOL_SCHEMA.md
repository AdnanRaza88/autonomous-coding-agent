# Tool Schema

All tools follow the OpenAI function-calling JSON schema format and are executed exclusively inside the session sandbox unless explicitly marked as control-plane tools.

## Core Tools

### read_file
```json
{
  "name": "read_file",
  "description": "Read the contents of a file in the workspace.",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Relative path from the repository root."
      },
      "offset": {
        "type": "integer",
        "description": "Line number to start reading from (1-based).",
        "default": 1
      },
      "limit": {
        "type": "integer",
        "description": "Maximum number of lines to return.",
        "default": 500
      }
    },
    "required": ["path"]
  }
}
```

### write_file
```json
{
  "name": "write_file",
  "description": "Write or overwrite a file in the workspace.",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string"
      },
      "content": {
        "type": "string"
      }
    },
    "required": ["path", "content"]
  }
}
```

### edit_file
```json
{
  "name": "edit_file",
  "description": "Replace a specific string in a file with a new string.",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string"
      },
      "old_string": {
        "type": "string"
      },
      "new_string": {
        "type": "string"
      },
      "replace_all": {
        "type": "boolean",
        "default": false
      }
    },
    "required": ["path", "old_string", "new_string"]
  }
}
```

### list_dir
```json
{
  "name": "list_dir",
  "description": "List files and directories at a path.",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "default": "."
      },
      "recursive": {
        "type": "boolean",
        "default": false
      }
    },
    "required": []
  }
}
```

### run_shell
```json
{
  "name": "run_shell",
  "description": "Execute a shell command inside the sandbox. Working directory is the repository root.",
  "parameters": {
    "type": "object",
    "properties": {
      "command": {
        "type": "string"
      },
      "timeout_seconds": {
        "type": "integer",
        "default": 120,
        "maximum": 600
      }
    },
    "required": ["command"]
  }
}
```

### git_status
```json
{
  "name": "git_status",
  "description": "Return git status --porcelain and current branch.",
  "parameters": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

### git_diff
```json
{
  "name": "git_diff",
  "description": "Return the current unstaged and staged diff.",
  "parameters": {
    "type": "object",
    "properties": {
      "staged": {
        "type": "boolean",
        "default": false
      }
    },
    "required": []
  }
}
```

### search_code
```json
{
  "name": "search_code",
  "description": "Search for a string or regex across the repository.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string"
      },
      "path": {
        "type": "string",
        "description": "Optional subdirectory to restrict the search."
      },
      "is_regex": {
        "type": "boolean",
        "default": false
      },
      "max_results": {
        "type": "integer",
        "default": 50
      }
    },
    "required": ["query"]
  }
}
```

### run_tests
```json
{
  "name": "run_tests",
  "description": "Execute the project test suite or a specific test target.",
  "parameters": {
    "type": "object",
    "properties": {
      "target": {
        "type": "string",
        "description": "Optional test path or marker."
      },
      "extra_args": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "required": []
  }
}
```

### create_branch
```json
{
  "name": "create_branch",
  "description": "Create and checkout a new git branch from the current HEAD.",
  "parameters": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string"
      }
    },
    "required": ["name"]
  }
}
```

### commit
```json
{
  "name": "commit",
  "description": "Stage all changes and create a commit with the given message.",
  "parameters": {
    "type": "object",
    "properties": {
      "message": {
        "type": "string"
      }
    },
    "required": ["message"]
  }
}
```

### open_pull_request
```json
{
  "name": "open_pull_request",
  "description": "Push the current branch and open a pull request against the base branch.",
  "parameters": {
    "type": "object",
    "properties": {
      "title": {
        "type": "string"
      },
      "body": {
        "type": "string"
      },
      "base": {
        "type": "string",
        "default": "main"
      },
      "draft": {
        "type": "boolean",
        "default": false
      }
    },
    "required": ["title", "body"]
  }
}
```

## Control-Plane Tools (not available inside the coding loop)

### request_human_input
```json
{
  "name": "request_human_input",
  "description": "Pause the agent and request guidance from the control panel.",
  "parameters": {
    "type": "object",
    "properties": {
      "question": {
        "type": "string"
      },
      "context": {
        "type": "string"
      }
    },
    "required": ["question"]
  }
}
```

### escalate
```json
{
  "name": "escalate",
  "description": "Terminate the current run and mark it as needing human attention.",
  "parameters": {
    "type": "object",
    "properties": {
      "reason": {
        "type": "string"
      }
    },
    "required": ["reason"]
  }
}
```

## Plan Schema (output of planner)

```json
{
  "type": "object",
  "properties": {
    "summary": { "type": "string" },
    "steps": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "description": { "type": "string" },
          "files": { "type": "array", "items": { "type": "string" } },
          "tests": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["id", "description"]
      }
    },
    "risks": { "type": "array", "items": { "type": "string" } },
    "acceptance_criteria": { "type": "array", "items": { "type": "string" } },
    "estimated_complexity": { "type": "string", "enum": ["low", "medium", "high"] }
  },
  "required": ["summary", "steps", "acceptance_criteria"]
}
```

## Reflection Schema

```json
{
  "type": "object",
  "properties": {
    "hypothesis": { "type": "string" },
    "evidence": { "type": "array", "items": { "type": "string" } },
    "proposed_changes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "file": { "type": "string" },
          "action": { "type": "string" },
          "detail": { "type": "string" }
        }
      }
    },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "should_retry": { "type": "boolean" }
  },
  "required": ["hypothesis", "proposed_changes", "confidence", "should_retry"]
}
```
