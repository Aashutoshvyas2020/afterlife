export function fakeDb() {
  const entitlements = [];
  const events = new Set();
  function statement(sql, values = []) {
    const query = {
      bind(...bound) { return statement(sql, bound); },
      async run() {
        if (sql.includes('INSERT INTO billing_entitlements')) {
          entitlements.push({ token_hash: values[0], checkout_key: values[1], checkout_session_id: null, state: 'pending' });
        } else if (sql.includes('UPDATE billing_entitlements SET checkout_session_id')) {
          const row = entitlements.find(item => item.checkout_key === values[1]);
          if (row && (row.checkout_session_id == null || row.checkout_session_id === values[0])) row.checkout_session_id = values[0];
        } else if (sql.includes("UPDATE billing_entitlements SET state = 'paid'")) {
          const row = entitlements.find(item => item.token_hash === values[1] && item.checkout_session_id === values[2]);
          if (row) row.state = 'paid';
        } else if (sql.includes('UPDATE billing_entitlements') && sql.includes('COALESCE(checkout_session_id')) {
          const row = entitlements.find(item => item.checkout_key === values[2] && (item.checkout_session_id == null || item.checkout_session_id === values[0]));
          if (row) { row.checkout_session_id ??= values[0]; row.state = 'paid'; }
        } else if (sql.includes('INSERT INTO stripe_events')) {
          events.add(values[0]);
        }
        return { success: true };
      },
      async first() {
        if (sql.includes('SELECT checkout_session_id')) return entitlements.find(item => item.checkout_key === values[0]) ?? null;
        if (sql.includes('SELECT state') && sql.includes('checkout_session_id')) return entitlements.find(item => item.token_hash === values[0] && item.checkout_session_id === values[1]) ?? null;
        if (sql.includes('SELECT state')) return entitlements.find(item => item.token_hash === values[0]) ?? null;
        if (sql.includes('SELECT event_id')) return events.has(values[0]) ? { event_id: values[0] } : null;
        return null;
      },
    };
    return query;
  }
  return {
    entitlements,
    prepare: sql => statement(sql),
    async batch(queries) { for (const query of queries) await query.run(); },
  };
}
