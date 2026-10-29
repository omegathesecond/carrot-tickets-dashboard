// Attempt every recipient even if one provider request fails. Report all errors.
export async function notifyRecipients(recipients, send) {
  const errors = [];
  for (const to of new Set(recipients)) {
    try { await send(to); }
    catch (error) { errors.push(new Error(`${to}: ${error.message}`, {cause:error})); }
  }
  if (errors.length) throw new AggregateError(errors, errors.map(error=>error.message).join('; '));
}
