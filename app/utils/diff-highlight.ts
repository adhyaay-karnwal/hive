import { createHighlighter, type Highlighter, type ThemedTokenWithVariants } from "shiki";
// @ts-ignore — pierre's theme is a valid VS Code theme JSON
import pierreDarkTheme from "../../node_modules/@pierre/diffs/dist/themes/pierre-dark.js";

const THEME_DARK = "pierre-dark";
const THEME_LIGHT = "github-light-default";

const commonLanguages = [
  "javascript", "typescript", "jsx", "tsx",
  "html", "css", "scss", "json", "yaml", "toml", "xml",
  "bash", "shell", "sh", "zsh",
  "python", "rust", "go", "ruby", "java", "c", "cpp",
  "sql", "graphql", "markdown", "mdx",
  "vue", "svelte", "dockerfile", "diff",
  "text", "plaintext",
];

let highlighterPromise: Promise<Highlighter> | null = null;

function getDiffHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [pierreDarkTheme, THEME_LIGHT],
      langs: commonLanguages,
    });
  }
  return highlighterPromise;
}

export type Token = {
  content: string;
  dark: string;
  light: string;
};

// Languages where a single line has no meaningful grammar context on its own.
// These must be tokenized as a full block to get correct highlighting.
const CONTEXT_LANGS = new Set(["vue", "svelte", "html", "mdx"]);

function mapRows(rows: ThemedTokenWithVariants[][], fallbackContent: string): Token[][] {
  if (!rows.length) return [[{ content: fallbackContent, dark: "#fbfbfb", light: "#24292e" }]];
  return rows.map((row) =>
    row.length
      ? row.map((t) => ({
          content: t.content,
          dark: t.variants.dark?.color || "#fbfbfb",
          light: t.variants.light?.color || "#24292e",
        }))
      : [{ content: "", dark: "#fbfbfb", light: "#24292e" }],
  );
}

export async function tokenizeLine(code: string, lang: string): Promise<Token[]> {
  const hl = await getDiffHighlighter();
  const loaded = hl.getLoadedLanguages();
  const language = loaded.includes(lang) ? lang : "text";

  const stripped = code.replace(/\n$/, "");
  const rows = hl.codeToTokensWithThemes(stripped, {
    lang: language,
    themes: { dark: THEME_DARK, light: THEME_LIGHT },
  });

  return mapRows(rows, code)[0];
}

/**
 * Tokenize multiple lines at once, preserving grammar context across lines.
 * Required for embedded-language files (Vue, Svelte, HTML) where a single
 * line has no meaningful grammar context on its own.
 */
export async function tokenizeLines(lines: string[], lang: string): Promise<Token[][]> {
  const hl = await getDiffHighlighter();
  const loaded = hl.getLoadedLanguages();
  const language = loaded.includes(lang) ? lang : "text";

  // Strip trailing newline from each line before joining, then tokenize the block
  const stripped = lines.map((l) => l.replace(/\n$/, ""));
  const code = stripped.join("\n");

  const rows = hl.codeToTokensWithThemes(code, {
    lang: language,
    themes: { dark: THEME_DARK, light: THEME_LIGHT },
  });

  // rows.length should equal lines.length; guard against edge cases
  return lines.map((line, i) => {
    const row = rows[i];
    if (!row?.length) return [{ content: line.replace(/\n$/, ""), dark: "#fbfbfb", light: "#24292e" }];
    return row.map((t) => ({
      content: t.content,
      dark: t.variants.dark?.color || "#fbfbfb",
      light: t.variants.light?.color || "#24292e",
    }));
  });
}

export { CONTEXT_LANGS };

export function getLangFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const name = filePath.split("/").pop()?.toLowerCase() || "";
  if (name === "dockerfile") return "dockerfile";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    vue: "vue", svelte: "svelte", html: "html", css: "css", scss: "scss",
    json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
    md: "markdown", mdx: "mdx", py: "python", rs: "rust", go: "go",
    rb: "ruby", java: "java", c: "c", cpp: "cpp", h: "c", hpp: "cpp",
    sql: "sql", graphql: "graphql", sh: "bash", bash: "bash", zsh: "bash",
    xml: "xml", svg: "xml",
  };
  return map[ext] || "text";
}
