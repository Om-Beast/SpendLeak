export function annotateAnomalies(anomalies, reviews = []) {
  const byTransaction = new Map(reviews.map((review) => [review.transactionId, review.status]));
  return anomalies.map((anomaly) => ({
    ...anomaly,
    reviewStatus: byTransaction.get(anomaly.transactionId) || 'open'
  }));
}
