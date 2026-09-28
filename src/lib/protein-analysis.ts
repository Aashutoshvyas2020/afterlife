export type Pocket = { id: string; druggability: number; volume: number; score: number };
export type AnalysisResult = { filename: string; pockets: Pocket[]; mode: "live" };
export const MAX_PDB_BYTES = 10 * 1024 * 1024;

export function validateProteinFile(file: File | null): string | null {
  if (!file) return "Choose a .pdb file before starting an analysis.";
  if (!/\.pdb$/i.test(file.name)) return "Choose a .pdb file. Other file types are not supported.";
  if (file.size === 0) return "This file is empty. Choose a PDB file containing a protein structure.";
  if (file.size > MAX_PDB_BYTES) return "This file is too large. Choose a PDB file up to 10 MB.";
  return null;
}

/** PDB input format is not yet agreed with the analysis service. Never submit file bytes as a generic run input. */
export async function analyzeProteinFile(file: File, { signal }: { signal: AbortSignal }): Promise<AnalysisResult> {
  signal.throwIfAborted();
  const error = validateProteinFile(file);
  if (error) throw new Error(error);
  throw new Error("Protein analysis is unavailable: the PDB input contract has not yet been agreed with the analysis service.");
}
