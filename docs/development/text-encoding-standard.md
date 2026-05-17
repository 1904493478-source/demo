# Text Encoding Standard

## Fixed Rule

All project source, test, script, and Markdown files are UTF-8 without BOM.

Terminal mojibake is not treated as proof that a file is damaged. A file is considered damaged only when the encoding check, TypeScript parser, lint, build, or tests fail.

## Required Workflow

When Chinese text looks garbled in terminal output:

1. Run `pnpm check:encoding`.
2. If it passes, continue development and avoid editing files just to "fix" terminal display.
3. If it fails, repair only the reported files.
4. For TS/TSX files, trust parser diagnostics over visual terminal output.
5. Prefer ASCII `data-testid` values in tests and UI automation. Do not depend on Chinese visible text when a stable test id exists.

## PowerShell Reading Tip

If a terminal view is needed, start the command with UTF-8 console settings:

```powershell
chcp 65001 > $null
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
```

This improves display, but it is still not the source of truth. `pnpm check:encoding` is the source of truth.

## Prevention

- Save text files as UTF-8 without BOM.
- Keep test selectors ASCII and stable, for example `data-testid="arrangement-view-arr_breakfast"`.
- Before final delivery, run `pnpm verify:answer`; it now includes `pnpm check:encoding`.
