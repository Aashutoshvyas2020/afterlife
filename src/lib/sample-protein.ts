// Synthetic coordinate fixture for the mock UI, not a research-grade protein.
const sample = `HEADER    POCKETSCAN SYNTHETIC DEMO FIXTURE
REMARK    FOR UI DEMONSTRATION ONLY. NOT FOR SCIENTIFIC ANALYSIS.
ATOM      1  N   ALA A   1      11.104  13.207   9.447  1.00 20.00           N
ATOM      2  CA  ALA A   1      12.560  13.200   9.447  1.00 20.00           C
ATOM      3  C   ALA A   1      13.100  14.600   9.447  1.00 20.00           C
ATOM      4  O   ALA A   1      12.500  15.600   9.447  1.00 20.00           O
TER
END
`;
export function createSampleProtein(): File {
  return new File([sample], "pocketscan-demo.pdb", { type: "text/plain" });
}
