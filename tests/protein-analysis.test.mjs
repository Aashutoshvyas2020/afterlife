import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeProteinFile, validateProteinFile, MAX_PDB_BYTES } from '../src/lib/protein-analysis.ts';

const pdb = 'ATOM      1  N   ALA A   1      11.104  13.207   9.447  1.00 20.00           N\nEND\n';
const options = () => ({ signal: new AbortController().signal });

test('requires a non-empty PDB file within the size limit', () => {
  assert.match(validateProteinFile(null), /Choose/);
  assert.match(validateProteinFile(new File([pdb], 'protein.txt')), /file types/);
  assert.match(validateProteinFile(new File([], 'protein.pdb')), /empty/);
  assert.match(validateProteinFile(new File([new Uint8Array(MAX_PDB_BYTES + 1)], 'large.pdb')), /too large/);
  assert.equal(validateProteinFile(new File([pdb], 'protein.PDB')), null);
});

test('rejects renamed text without atom records', async () => {
  await assert.rejects(analyzeProteinFile(new File(['not a protein'], 'bad.pdb'), options()), /No atom records/);
});

test('reports file-read failures', async () => {
  const file = new File([pdb], 'unreadable.pdb');
  file.text = async () => { throw new Error('read failure'); };
  await assert.rejects(analyzeProteinFile(file, options()), /could not be read/);
});

test('returns typed mock results tied to the selected filename', async () => {
  const result = await analyzeProteinFile(new File([pdb], 'protein.PDB'), options());
  assert.equal(result.filename, 'protein.PDB');
  assert.equal(result.mode, 'mock');
  assert.equal(result.pockets.length, 3);
  assert.ok(result.pockets.every(p => typeof p.score === 'number'));
});

test('cancels an active analysis rather than returning stale results', async () => {
  const controller = new AbortController();
  const pending = analyzeProteinFile(new File([pdb], 'protein.pdb'), { signal: controller.signal });
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(pending, { name: 'AbortError' });
});

test('handles cancellation before analysis starts', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(analyzeProteinFile(new File([pdb], 'protein.pdb'), { signal: controller.signal }), { name: 'AbortError' });
});

test('empty results remain empty rather than fabricating pockets', async () => {
  const result = await analyzeProteinFile(new File([pdb], 'empty-demo.pdb'), {...options(), scenario:'empty'});
  assert.deepEqual(result.pockets, []);
});

test('service failure is surfaced for retry', async () => {
  await assert.rejects(analyzeProteinFile(new File([pdb], 'protein.pdb'), {...options(), scenario:'failure'}), /service could not complete/);
});

test('synthetic sample works through the same validation and analysis path', async () => {
  const { createSampleProtein } = await import('../src/lib/sample-protein.ts');
  const file = createSampleProtein();
  assert.equal(validateProteinFile(file), null);
  const result = await analyzeProteinFile(file, options());
  assert.equal(result.filename, 'pocketscan-demo.pdb');
  assert.equal(result.mode, 'mock');
});
