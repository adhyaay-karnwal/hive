<script lang="ts">
import { Marked } from "marked";
import markedShiki from "marked-shiki";
import DOMPurify from "dompurify";
import { createHighlighter, type Highlighter } from "shiki";

// True module-level singleton — shared across ALL component instances.
// This prevents creating 40+ Shiki highlighter instances when rendering
// a conversation with many code blocks.

const THEME_DARK = "github-dark-default";
const THEME_LIGHT = "github-light-default";

const commonLanguages = [
  "javascript", "typescript", "jsx", "tsx",
  "html", "css", "scss",
  "json", "yaml", "toml", "xml",
  "bash", "shell", "sh", "zsh",
  "python", "rust", "go", "ruby", "java", "c", "cpp",
  "sql", "graphql",
  "markdown", "mdx",
  "vue", "svelte",
  "dockerfile", "diff",
  "text", "plaintext",
];

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [THEME_DARK, THEME_LIGHT],
      langs: commonLanguages,
    });
  }
  return highlighterPromise;
}

const marked = new Marked();
let markedReady: Promise<void> | null = null;

function ensureMarked(): Promise<void> {
  if (!markedReady) {
    markedReady = getHighlighter().then((hl) => {
      marked.use(
        markedShiki({
          highlight(code, lang) {
            const language = lang && hl.getLoadedLanguages().includes(lang) ? lang : "text";
            return hl.codeToHtml(code, {
              lang: language,
              themes: { dark: THEME_DARK, light: THEME_LIGHT },
              defaultColor: false,
            });
          },
        }),
      );
    });
  }
  return markedReady;
}

// Cache is module-level — survives HMR during dev. Clear on code change.
const renderCache = new Map<string, string>();
if (import.meta.hot) {
  import.meta.hot.on("vite:beforeUpdate", () => {
    renderCache.clear();
    markedReady = null;
  });
}

async function renderMarkdown(text: string): Promise<string> {
  const cached = renderCache.get(text);
  if (cached) return cached;

  await ensureMarked();
  const raw = await marked.parse(text);
  const html = DOMPurify.sanitize(raw, {
    FORBID_TAGS: ["style"],
    ADD_ATTR: ["target", "style"],
  });

  renderCache.set(text, html);
  return html;
}
</script>

<script setup lang="ts">
interface Props {
  content: string;
}

const { content } = defineProps<Props>();
const rendered = ref(renderCache.get(content) || "");

watch(() => content, async (val) => {
  rendered.value = await renderMarkdown(val);
}, { immediate: true });
</script>

<template>
  <div class="o-markdown text-copy text-primary" v-html="rendered" />
</template>

<style>
.o-markdown {
  line-height: 1.7;
  font-size: 0.9375rem;
  color: var(--text-color-primary);
  overflow-wrap: break-word;
  word-break: break-word;
}

/* ── Paragraphs ── */

.o-markdown p {
  margin: 0.625em 0;
}

.o-markdown p:first-child {
  margin-top: 0;
}

.o-markdown p:last-child {
  margin-bottom: 0;
}

/* ── Headings ── */

.o-markdown h1,
.o-markdown h2,
.o-markdown h3,
.o-markdown h4 {
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 1.5em 0 0.5em;
}

.o-markdown h1:first-child,
.o-markdown h2:first-child,
.o-markdown h3:first-child,
.o-markdown h4:first-child {
  margin-top: 0;
}

.o-markdown h1 { font-size: 1.375em; }
.o-markdown h2 { font-size: 1.2em; }
.o-markdown h3 { font-size: 1.05em; }
.o-markdown h4 { font-size: 1em; color: var(--text-color-secondary); }

/* ── Code ── */

.o-markdown pre {
  background: var(--color-base-0);
  border: 1px solid var(--border-color-edge);
  border-radius: 0.625rem;
  padding: 0.875rem 1rem;
  margin: 1em 0;
  overflow-x: auto;
  font-size: 0.8125rem;
  line-height: 1.6;
  font-family: var(--font-mono);
}

.o-markdown pre code {
  background: none;
  padding: 0;
  border: none;
  border-radius: 0;
  font-size: inherit;
  color: inherit;
}

.o-markdown code {
  background: oklch(from var(--base) calc(l + var(--surface-1) * var(--dir)) c h);
  padding: 0.15em 0.4em;
  border-radius: 0.3em;
  font-size: 0.84em;
  font-family: var(--font-mono);
  color: var(--text-color-primary);
}

/* ── Lists ── */

.o-markdown ul,
.o-markdown ol {
  margin: 0.625em 0;
  padding-left: 1.625em;
}

.o-markdown ul {
  list-style-type: disc;
}

.o-markdown ol {
  list-style-type: decimal;
}

.o-markdown li {
  margin: 0.35em 0;
  padding-left: 0.25em;
}

.o-markdown li > ul,
.o-markdown li > ol {
  margin: 0.25em 0;
}

.o-markdown li::marker {
  color: var(--text-color-tertiary);
}

/* ── Blockquotes ── */

.o-markdown blockquote {
  border-left: 3px solid var(--border-color-edge-strong);
  padding: 0.125em 0 0.125em 1em;
  margin: 0.75em 0;
  color: var(--text-color-secondary);
}

.o-markdown blockquote p {
  margin: 0.375em 0;
}

/* ── Links ── */

.o-markdown a {
  color: var(--color-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: oklch(from var(--color-accent) l c h / 0.3);
  transition: text-decoration-color 0.15s;
}

.o-markdown a:hover {
  text-decoration-color: var(--color-accent);
}

/* ── Horizontal rule ── */

.o-markdown hr {
  border: none;
  border-top: 1px solid var(--border-color-edge);
  margin: 1.5em 0;
}

/* ── Tables ── */

.o-markdown table {
  border-collapse: collapse;
  margin: 1em 0;
  width: 100%;
  font-size: 0.875em;
  line-height: 1.5;
}

.o-markdown th,
.o-markdown td {
  border: 1px solid var(--border-color-edge);
  padding: 0.5rem 0.75rem;
  text-align: left;
}

.o-markdown th {
  font-weight: 600;
  font-size: 0.8125em;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-color-secondary);
  background: oklch(from var(--base) calc(l + var(--surface-1) * var(--dir)) c h);
}

.o-markdown tr:hover td {
  background: oklch(from var(--base) calc(l + var(--surface-1) * var(--dir) * 0.5) c h);
}

/* ── Strong / Em ── */

.o-markdown strong {
  font-weight: 600;
  color: var(--text-color-primary);
}

.o-markdown em {
  font-style: italic;
}

/* ── Images ── */

.o-markdown img {
  max-width: 100%;
  border-radius: 0.5rem;
  margin: 0.75em 0;
}

/* ── Shiki dual-theme ── */

/* The app defaults to dark (no class on <html>); light mode adds class="light". */
/* Shiki's defaultColor:false emits --shiki-dark / --shiki-light CSS vars per token. */

.o-markdown .shiki {
  background: transparent !important;
}

.o-markdown .shiki span {
  color: var(--shiki-dark) !important;
}

:root.light .o-markdown .shiki span {
  color: var(--shiki-light) !important;
}
</style>
