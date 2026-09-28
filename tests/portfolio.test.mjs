import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRunSnapshot, subscribePortfolioRun } from '../src/lib/portfolio.ts';

test('selects one investment and requires all launch steps before live', () => {
  assert.deepEqual(getRunSnapshot(null).candidates, ['Queued','Queued','Queued']);
  const decision = getRunSnapshot(10);
  assert.deepEqual(decision.candidates, ['Pass','Invest','Pass']);
  assert.equal(decision.live, false);
  const deployed = getRunSnapshot(17);
  assert.equal(deployed.live, false);
  assert.equal(deployed.milestones.at(-1), 'In progress');
  const complete = getRunSnapshot(50);
  assert.equal(complete.status, 'complete');
  assert.equal(complete.live, true);
  assert.ok(complete.milestones.every(s => s === 'Complete'));
});

test('evaluation failure cannot approve investments or launch products', () => {
  const run = getRunSnapshot(50, 'evaluation-failure');
  assert.equal(run.status, 'failed');
  assert.equal(run.invested, false);
  assert.equal(run.live, false);
  assert.ok(run.candidates.every(s => s === 'Failed'));
  assert.equal(run.events.at(-1).label, 'Evaluation failed');
});

test('repair failure preserves the decision but stops all later milestones', () => {
  const run = getRunSnapshot(50, 'repair-failure');
  assert.equal(run.invested, true);
  assert.equal(run.live, false);
  assert.deepEqual(run.milestones, ['Complete','Failed','Pending','Pending','Pending']);
  assert.ok(!run.events.some(e => e.label === 'Deployed' || e.label === 'Build repaired'));
});

test('unsubscribing prevents stale updates after reset', (t) => {
  t.mock.timers.enable({apis:['setInterval','Date']});
  const updates = [];
  const stop = subscribePortfolioRun(run => updates.push(run));
  t.mock.timers.tick(1000);
  stop();
  const count = updates.length;
  t.mock.timers.tick(30000);
  assert.equal(updates.length, count);
});
