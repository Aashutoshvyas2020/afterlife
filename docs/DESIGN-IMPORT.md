# Exact design import

The visible UI now renders the user's `Afterlife Console.dc.html` and
`PocketScan.dc.html` exports, rather than a reinterpretation of them. The
exported DOM, inline layouts, typography, controls, and stateful interactions
are preserved. This includes the two console sidebars and PocketScan's separate
Product, App, Pricing, and Account views, scan history, comparison, exports,
and interactive 3D viewer.

## Files and reproduction

- `src/designs/*.json`: the original templates and their local prototype logic.
- `src/vendor/design-runtime.js`: template renderer from the supplied `support.js`,
  adapted to use the application's installed React. It does not bootstrap a
  second React root, expose the editor message API, or download React from a CDN.
- `src/components/design-screen.tsx`: client-only wrapper shared by Next routes.
- `scripts/import-designs.py`: deterministic importer. Run with the directory
  containing the original exports and support.js as its argument.
- `public/vendor/3Dmol-min.js`: 3Dmol 2.4.0 from the exact URL in the export.
- `public/structures/*.pdb`: RCSB examples 1HSG, 3PTB, and 1STP, downloaded from
  `https://files.rcsb.org/download/<ID>.pdb`. These are molecular structures,
  not validation data for the prototype's pocket estimates.

The renderer evaluates only bundled, developer-controlled prototype code.
Never feed server responses, user input, or uploaded files into its template or
logic inputs. Uploaded PDB contents are parsed as structure data only.

## Intentional differences from the exports

- Links open existing Next routes; fonts, viewer, and sample structures use local
  assets to avoid requiring external services during the demo.
- SVG attributes are normalized for React, and focus outlines are provided.
- Integration badges say Simulated rather than Connected.
- Analysis and checkout copy distinguish demo heuristics from fpocket computation
  and actual payments. There is no real billing or validated pocket analysis.
- Demo access uses the existing sessionStorage key, `pocketscan-demo-pro`.
- Direct entry into `/checkout/success` cannot unlock access.
- Viewer spinning is stopped when its view unmounts.

## Backend handoff change

The source exports contain their own prototype state machines. The adapters in
`src/lib/portfolio.ts` and `src/lib/protein-analysis.ts` are retained, but **are not
currently driving the imported screens**. Their existing tests do not validate
this imported UI. Use browser checks for the visible flows, and replace the
prototype logic with agreed real APIs when integrating the backend. Do not
assume passing adapter tests means a real provider is connected.

The source PocketScan preview uses structure-derived heuristic pocket positions
and scores, not fpocket. It stores scan history and small uploaded structures
locally in the browser; there is no upload to a backend. Account controls can
clear this history. Both scientific results and paid access remain demo-only.
