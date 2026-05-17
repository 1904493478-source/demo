import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import process from "node:process";
import ts from "typescript";

const root = process.cwd();
const checkedDirectories = ["src", "docs", "scripts", ".codex"].map((dir) => resolve(root, dir));
const checkedRootFiles = [
  "AGENTS.md",
  "README.md",
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
].map((file) => resolve(root, file));
const textExtensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
]);
const ignoredDirectoryNames = new Set(["node_modules", "dist", ".git"]);

const files = [...checkedRootFiles.filter(fileExists), ...collectFiles(checkedDirectories)];
const issues = [];

for (const file of files) {
  const buffer = readFileSync(file);
  const text = buffer.toString("utf8");
  const displayPath = normalizePath(relative(root, file));

  if (hasUtf8Bom(buffer)) {
    issues.push(`${displayPath}: has a UTF-8 BOM; save as UTF-8 without BOM`);
  }

  if (text.includes("\uFFFD")) {
    issues.push(`${displayPath}: contains replacement characters; content is likely damaged`);
  }

  const nulIndex = buffer.indexOf(0);
  if (nulIndex !== -1) {
    issues.push(`${displayPath}: contains a NUL byte at offset ${nulIndex}`);
  }

  if (file.endsWith(".ts") || file.endsWith(".tsx")) {
    issues.push(...getTypescriptDiagnostics(file, text, displayPath));
  }
}

if (issues.length > 0) {
  console.error("text encoding check failed:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(`text encoding check passed: ${files.length} files checked`);

function collectFiles(paths) {
  const result = [];

  for (const path of paths) {
    if (!fileExists(path)) continue;
    const stat = statSync(path);

    if (stat.isDirectory()) {
      const baseName = path.split(/[\\/]/).at(-1) ?? "";
      if (ignoredDirectoryNames.has(baseName)) continue;

      for (const child of readdirSync(path)) {
        result.push(...collectFiles([join(path, child)]));
      }
      continue;
    }

    if (stat.isFile() && textExtensions.has(extname(path))) {
      result.push(path);
    }
  }

  return result;
}

function getTypescriptDiagnostics(file, text, displayPath) {
  const scriptKind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.ES2020, true, scriptKind);
  const output = ts.transpileModule(text, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: file,
    reportDiagnostics: true,
  });

  return (output.diagnostics ?? [])
    .filter((diagnostic) => isParseDiagnostic(diagnostic.code))
    .map((diagnostic) => {
      const position = ts.getLineAndCharacterOfPosition(sourceFile, diagnostic.start ?? 0);
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
      return `${displayPath}:${position.line + 1}:${position.character + 1}: ${message}`;
    });
}

function isParseDiagnostic(code) {
  return code >= 1000 && code < 1200;
}

function hasUtf8Bom(buffer) {
  return buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
}

function fileExists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

function normalizePath(path) {
  return path.replace(/\\/g, "/");
}
