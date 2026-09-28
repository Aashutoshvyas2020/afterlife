export type AnalysisScenario = "success" | "empty" | "failure" | "slow";

export type Pocket = {
  id: string;
  druggability: number;
  volume: number;
  score: number;
};

export type AnalysisResult = {
  filename: string;
  pockets: Pocket[];
  mode: "mock" | "live";
};

export const MAX_PDB_BYTES = 10 * 1024 * 1024;

export function validateProteinFile(file: File | null): string | null {
  if (!file) return "Choose a .pdb file before starting an analysis.";
  if (!/\.pdb$/i.test(file.name)) return "Choose a .pdb file. Other file types are not supported.";
  if (file.size === 0) return "This file is empty. Choose a PDB file containing a protein structure.";
  if (file.size > MAX_PDB_BYTES) return "This file is too large. Choose a PDB file up to 10 MB.";
  return null;
}

function delay(signal: AbortSignal, milliseconds = 1800): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    function abort() {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      reject(signal.reason);
    }
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** Single integration point: replace the mock with the agreed backend request.
 * Keep this result shape and forward signal to fetch for cancellation.
 * No files leave the browser in mock mode. This is not a scientific PDB validator.
 */
export async function analyzeProteinFile(
  file: File,
  { signal, scenario = "success" }: { signal: AbortSignal; scenario?: AnalysisScenario },
): Promise<AnalysisResult> {
  signal.throwIfAborted();
  const error = validateProteinFile(file);
  if (error) throw new Error(error);

  let contents: string;
  try {
    contents = await file.text();
  } catch {
    throw new Error("This file could not be read. Choose it again and retry.");
  }
  signal.throwIfAborted();
  if (!/^(ATOM  |HETATM)/m.test(contents)) {
    throw new Error("No atom records found. Choose a PDB structure containing ATOM or HETATM records.");
  }
  await delay(signal, scenario === "slow" ? 10000 : 1800);
  if (scenario === "failure") throw new Error("The analysis service could not complete this request. Retry or choose another structure.");
  return {
    filename: file.name,
    mode: "mock",
    pockets: scenario === "empty" ? [] : [
      { id: "1", druggability: 0.82, volume: 742, score: 38.4 },
      { id: "2", druggability: 0.61, volume: 391, score: 24.7 },
      { id: "3", druggability: 0.43, volume: 214, score: 16.2 },
    ],
  };
}
