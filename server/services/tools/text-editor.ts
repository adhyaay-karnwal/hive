import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "fs";
import { resolve, dirname } from "path";
import { tool, jsonSchema } from "ai";
import type { AnthropicProvider } from "@ai-sdk/anthropic";
import type { GoogleProvider } from "@ai-sdk/google";
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from "fs";
import { resolve, dirname } from "path";
import type { AnthropicProvider } from "@ai-sdk/anthropic";

function resolvePath(basePath: string, filePath: string): string {
  // The model tends to prefix paths with /repo (its trained container convention).
  // Strip that prefix so we resolve relative to the actual basePath.
  const stripped = filePath.replace(/^\/repo\/?/, "");
  const resolved = resolve(basePath, stripped);
  return resolved;
}

function viewFile(filePath: string, viewRange?: [number, number]): string {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stat = statSync(filePath);

  if (stat.isDirectory()) {
    const entries = readdirSync(filePath, { withFileTypes: true });
    return entries
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .join("\n");
  }

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  if (viewRange) {
    const [start, end] = viewRange;
    const startIdx = Math.max(0, start - 1);
    const endIdx = Math.min(lines.length, end);
    return lines
      .slice(startIdx, endIdx)
      .map((line, i) => `${startIdx + i + 1}: ${line}`)
      .join("\n");
  }

  return lines.map((line, i) => `${i + 1}: ${line}`).join("\n");
}

function createFile(filePath: string, fileText: string): string {
  if (existsSync(filePath)) {
    throw new Error(
      `File already exists: ${filePath}. Use str_replace to edit existing files.`,
    );
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, fileText, "utf-8");
  return `File created: ${filePath}`;
}

function strReplace(
  filePath: string,
  oldStr: string,
  newStr: string,
): string {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = readFileSync(filePath, "utf-8");

  // Count occurrences
  const occurrences = content.split(oldStr).length - 1;

  if (occurrences === 0) {
    throw new Error(
      `old_str not found in ${filePath}. Make sure the string matches exactly, including whitespace and indentation.`,
    );
  }

  if (occurrences > 1) {
    throw new Error(
      `Found ${occurrences} matches for old_str in ${filePath}. Provide more context to make the match unique.`,
    );
  }

  const newContent = content.replace(oldStr, newStr);
  writeFileSync(filePath, newContent, "utf-8");

  // Find the replacement location using the original content (before replace),
  // so we don't fall into the indexOf("") === 0 trap when newStr is empty.
  const insertionIdx = content.indexOf(oldStr);
  const startLine = content.slice(0, insertionIdx).split("\n").length;
  const replacedLines = newStr.split("\n");
  const endLine = startLine + replacedLines.length - 1;

  // Show a few lines of context around the edit
  const newLines = newContent.split("\n");
  const contextStart = Math.max(0, startLine - 3);
  const contextEnd = Math.min(newLines.length, endLine + 3);

  const preview = newLines
    .slice(contextStart, contextEnd)
    .map((line, i) => `${contextStart + i + 1}: ${line}`)
    .join("\n");

  return `Replaced in ${filePath}:\n${preview}`;
}

function insertText(
  filePath: string,
  insertLine: number,
  insertText: string,
): string {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  if (insertLine < 0 || insertLine > lines.length) {
    throw new Error(
      `Line number ${insertLine} is out of range (0-${lines.length}).`,
    );
  }

  const newLines = insertText.split("\n");
  lines.splice(insertLine, 0, ...newLines);

  const newContent = lines.join("\n");
  writeFileSync(filePath, newContent, "utf-8");

  // Show context around insertion
  const contextStart = Math.max(0, insertLine - 2);
  const contextEnd = Math.min(
    lines.length,
    insertLine + newLines.length + 2,
  );

  const preview = lines
    .slice(contextStart, contextEnd)
    .map((line, i) => `${contextStart + i + 1}: ${line}`)
    .join("\n");

  return `Inserted at line ${insertLine} in ${filePath}:\n${preview}`;
}

/**
 * Create a text editor tool scoped to a base directory.
 * Works with both Anthropic and Gemini providers.
 */
export function createTextEditorTool(
  provider: AnthropicProvider | GoogleProvider,
  basePath: string,
) {
  // Use provider-specific tools if available (Anthropic), otherwise use generic tool
  if ("tools" in provider && typeof (provider as any).tools.textEditor_20250728 === "function") {
    return (provider as AnthropicProvider).tools.textEditor_20250728({
      async execute({ command, path, old_str, new_str, file_text, insert_line, insert_text, view_range }) {
        const filePath = resolvePath(basePath, path);

        try {
          switch (command) {
            case "view":
              return viewFile(filePath, view_range);

            case "create":
              if (file_text === undefined) {
                return "Error: file_text is required for create command.";
              }
              return createFile(filePath, file_text);

            case "str_replace":
              if (old_str === undefined) {
                return "Error: old_str is required for str_replace command.";
              }
              if (new_str === undefined) {
                return "Error: new_str is required for str_replace command.";
              }
              return strReplace(filePath, old_str, new_str);

            case "insert":
              if (insert_line === undefined) {
                return "Error: insert_line is required for insert command.";
              }
              if (insert_text === undefined) {
                return "Error: insert_text is required for insert command.";
              }
              return insertText(filePath, insert_line, insert_text);

            default:
              return `Error: Unknown command "${command}".`;
          }
        } catch (e: any) {
          return `Error: ${e.message}`;
        }
      },
    });
  }

  // Generic tool for Gemini or other providers
  return tool({
    description: "View, create, and edit files in the project directory",
    parameters: jsonSchema<{
      command: "view" | "create" | "str_replace" | "insert";
      path: string;
      old_str?: string;
      new_str?: string;
      file_text?: string;
      insert_line?: number;
      insert_text?: string;
      view_range?: [number, number];
    }>({
      type: "object",
      properties: {
        command: {
          type: "string",
          enum: ["view", "create", "str_replace", "insert"],
          description: "The command to execute",
        },
        path: {
          type: "string",
          description: "Path to the file (relative to project root)",
        },
        old_str: {
          type: "string",
          description: "The string to replace (for str_replace command)",
        },
        new_str: {
          type: "string",
          description: "The replacement string (for str_replace command)",
        },
        file_text: {
          type: "string",
          description: "The file content (for create command)",
        },
        insert_line: {
          type: "number",
          description: "Line number to insert at (for insert command)",
        },
        insert_text: {
          type: "string",
          description: "Text to insert (for insert command)",
        },
        view_range: {
          type: "array",
          items: { type: "number" },
          description: "Line range to view [start, end]",
        },
      },
      required: ["command", "path"],
    }),
    execute: async ({ command, path, old_str, new_str, file_text, insert_line, insert_text, view_range }) => {
      const filePath = resolvePath(basePath, path);

      try {
        switch (command) {
          case "view":
            return viewFile(filePath, view_range);

          case "create":
            if (file_text === undefined) {
              return "Error: file_text is required for create command.";
            }
            return createFile(filePath, file_text);

          case "str_replace":
            if (old_str === undefined) {
              return "Error: old_str is required for str_replace command.";
            }
            if (new_str === undefined) {
              return "Error: new_str is required for str_replace command.";
            }
            return strReplace(filePath, old_str, new_str);

          case "insert":
            if (insert_line === undefined) {
              return "Error: insert_line is required for insert command.";
            }
            if (insert_text === undefined) {
              return "Error: insert_text is required for insert command.";
            }
            return insertText(filePath, insert_line, insert_text);

          default:
            return `Error: Unknown command "${command}".`;
        }
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    },
  });
}
 * Create a text editor tool scoped to a base directory.
 * Uses the Anthropic provider-defined text editor tool with a custom execute.
 */
export function createTextEditorTool(
  anthropic: AnthropicProvider,
  basePath: string,
) {
  return anthropic.tools.textEditor_20250728({
    async execute({ command, path, old_str, new_str, file_text, insert_line, insert_text, view_range }) {
      const filePath = resolvePath(basePath, path);

      try {
        switch (command) {
          case "view":
            return viewFile(filePath, view_range);

          case "create":
            if (file_text === undefined) {
              return "Error: file_text is required for create command.";
            }
            return createFile(filePath, file_text);

          case "str_replace":
            if (old_str === undefined) {
              return "Error: old_str is required for str_replace command.";
            }
            if (new_str === undefined) {
              return "Error: new_str is required for str_replace command.";
            }
            return strReplace(filePath, old_str, new_str);

          case "insert":
            if (insert_line === undefined) {
              return "Error: insert_line is required for insert command.";
            }
            if (insert_text === undefined) {
              return "Error: insert_text is required for insert command.";
            }
            return insertText(filePath, insert_line, insert_text);

          default:
            return `Error: Unknown command "${command}".`;
        }
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    },
  });
}
