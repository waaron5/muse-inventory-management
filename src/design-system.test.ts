import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clientColours } from "./lib/client-colour";

// The rules in docs/design-system.md that a machine can check: colour lives
// only in globals.css' tokens, and every hover and selected state uses the
// one neutral ladder, so Dark mode is only a second value on each token.

const root = join(process.cwd(), "src");
const files = readdirSync(root, { recursive: true, encoding: "utf8" })
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
  .map((f) => ({ file: f, text: readFileSync(join(root, f), "utf8") }));

function offenders(pattern: RegExp, allowed: (match: string, file: string) => boolean = () => false) {
  return files.flatMap(({ file, text }) =>
    [...text.matchAll(pattern)].filter((m) => !allowed(m[0], file)).map((m) => `${file}: ${m[0]}`),
  );
}

describe("the design system", () => {
  it("keeps raw colours out of components", () => {
    // The browser's theme-color is metadata, not CSS, so it can't read a token.
    expect(offenders(/#[0-9a-fA-F]{3,8}\b/g, (_, file) => file === join("app", "layout.tsx"))).toEqual([]);
  });

  it("uses tokens, not Tailwind's palette", () => {
    const palette =
      /\b(?:bg|text|border|ring|outline|fill|stroke|shadow|divide|from|via|to|decoration|accent|caret)-(?:black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b/g;
    expect(offenders(palette)).toEqual([]);
  });

  it("gives every hover, press, highlight and open state a step of the neutral ladder", () => {
    const state = /\b(?:hover|active|data-highlighted|data-\[state=open\]):bg-([\w-]+)/g;
    const ladder = new Set(["hover", "row-hover", "selected", "main-hover", "alert-surface"]);
    expect(offenders(state, (match) => ladder.has(match.split(":bg-")[1]))).toEqual([]);
  });

  it("filters with chips, not the browser's own select", () => {
    expect(offenders(/<select\b/g, (_, file) => file === join("components", "form.tsx"))).toEqual([]);
  });
});

// Dark mode is a second value on each token: `light-dark(light, dark)`, picked
// by the page's color-scheme. These read both themes back out of globals.css.

const css = readFileSync(join(root, "app", "globals.css"), "utf8");

function declarations(selector: string) {
  const block = css.match(new RegExp(`${selector.replace(/[.*]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1];
  if (!block) throw new Error(`no ${selector} in globals.css`);
  const stripped = block.replace(/\/\*[\s\S]*?\*\//g, "");
  return new Map([...stripped.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const tokens = declarations(":root");
type Theme = "light" | "dark";

function resolve(value: string, theme: Theme, scope = tokens): string {
  const pair = value.match(/^light-dark\((.+),\s*(.+)\)$/);
  if (pair) return resolve(theme === "light" ? pair[1] : pair[2], theme, scope);
  const ref = value.match(/^var\(--([\w-]+)\)$/);
  if (ref) {
    const next = scope.get(ref[1]) ?? tokens.get(ref[1]);
    if (!next) throw new Error(`--${ref[1]} isn't a token`);
    return resolve(next, theme, scope);
  }
  return value;
}

function luminance(colour: string) {
  const hex = colour.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (!hex) throw new Error(`${colour} isn't an opaque #rrggbb colour`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(text: string, background: string) {
  const [a, b] = [luminance(text), luminance(background)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

describe.each<Theme>(["light", "dark"])("%s mode", (theme) => {
  const colour = (token: string, scope?: Map<string, string>) => resolve(`var(--${token})`, theme, scope);

  // Text, and the surfaces it sits on: rows, hovered and selected rows, chips,
  // status pills (warning and plain badges, form errors, "Saved").
  const pairs: [text: string, background: string][] = [
    ...["bg", "bg-subtle", "fill", "hover", "selected"].map((bg): [string, string] => ["ink", bg]),
    ...["bg", "bg-subtle", "fill", "hover"].map((bg): [string, string] => ["text-subtle", bg]),
    ["cyan-ink", "bg"],
    ["cyan-ink", "bg-subtle"],
    ["alert-text", "alert-surface"],
    ["alert-text", "bg"],
    ["warning-text", "warning-surface"],
    ["warning-text", "bg"],
    ["success-text", "success-surface"],
    ["success-text", "bg"],
    ["paper-ink", "paper"],
    ["paper-subtle", "paper"],
  ];

  it.each(pairs)("puts %s on %s at WCAG AA (4.5:1)", (text, background) => {
    expect(contrast(colour(text), colour(background))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(clientColours)("puts a name on the %s Client colour at AA, its stripe at 3:1", (name) => {
    const client = declarations(`.client-${name}`);
    expect(contrast(colour("ink"), colour("client-wash", client))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colour("client-accent", client), colour("bg"))).toBeGreaterThanOrEqual(3);
  });

  it.each(clientColours)("puts the %s Client's name in its own ink at AA, on a row at rest and hovered", (name) => {
    const client = declarations(`.client-${name}`);
    expect(contrast(colour("client-ink", client), colour("bg"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colour("client-ink", client), colour("row-hover"))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("Dark mode", () => {
  // Muse cyan is the same in both themes, and paper stays white (docs/design-system.md).
  const sameInBoth = new Set(["cyan", "main", "main-hover", "on-main", "paper", "paper-ink", "paper-subtle", "paper-line"]);

  it("gives every colour token a dark value", () => {
    const literal = [...tokens].filter(([name, value]) => /^(?:#|rgba?\()/.test(value) && !sameInBoth.has(name));
    expect(literal.map(([name]) => name)).toEqual([]);
  });

  it("gives every Client colour a dark value", () => {
    for (const name of clientColours) {
      for (const [token, value] of declarations(`.client-${name}`)) expect(value, `${name} ${token}`).toMatch(/^light-dark\(/);
    }
  });
});
