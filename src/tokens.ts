import StyleDictionary from "style-dictionary";

export type Token = {
  path: string[];
  value: string;
  raw: unknown;
  type?: string;
  alias?: string;
};

export async function loadTokens(dirs: string[]): Promise<Token[]> {
  const sd = new StyleDictionary({
    source: dirs.map((d) => `${d.replaceAll("\\", "/")}/**/*.{json,json5}`),
    platforms: { raw: {} },
    log: { verbosity: "silent", warnings: "disabled", errors: { brokenReferences: "console" } },
  });
  const { allTokens } = await sd.getPlatformTokens("raw");
  return allTokens.map((t) => {
    const raw = t.$value ?? t.value;
    const original = t.original.$value ?? t.original.value;
    const type = t.$type ?? t.type;
    return {
      path: t.path,
      raw,
      type,
      value: stringify(raw),
      alias: typeof original === "string" && /^\{[^}]+\}$/.test(original) ? original : undefined,
    };
  });
}

function stringify(v: unknown): string {
  return typeof v === "string" ? v : JSON.stringify(v);
}

export const startsWith = (path: string[], prefix: string[]) => prefix.every((p, i) => path[i] === p);
