import test from 'node:test';
import assert from 'node:assert/strict';
import { annotateAnomalies } from '../server/lib/reviews.js';

const anomalies = [
  { transactionId: 'tx-1', type: 'possible_duplicate', title: 'Possible duplicate' },
  { transactionId: 'tx-2', type: 'unusual_amount', title: 'Higher-than-usual amount' }
];

test('unreviewed findings remain open by default', () => {
  const result = annotateAnomalies(anomalies);
  assert.deepEqual(result.map((item) => item.reviewStatus), ['open', 'open']);
  assert.notEqual(result[0], anomalies[0]);
});

test('review state is associated only with its transaction id', () => {
  const result = annotateAnomalies(anomalies, [
    { transactionId: 'tx-1', status: 'dismissed' },
    { transactionId: 'tx-2', status: 'reviewed' },
    { transactionId: 'another-user-row', status: 'reviewed' }
  ]);
  assert.deepEqual(result.map((item) => item.reviewStatus), ['dismissed', 'reviewed']);
  assert.equal(anomalies[0].reviewStatus, undefined);
});

test('unknown review states default to open', () => {
  const result = annotateAnomalies(anomalies, [
    { transactionId: 'tx-1', status: 'open' }
  ]);
  assert.equal(result[0].reviewStatus, 'open');
});
