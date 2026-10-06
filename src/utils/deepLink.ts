export interface QuickAddRequest {
  taskId: string;
  operationId: string;
}

/** URL parameters are untrusted, including links bearing a widget-looking prefix.
 * This only validates a proposal. The screen must obtain an explicit confirmation.
 */
export function parseQuickAddRequest(params: {
  id?: unknown;
  quickAdd?: unknown;
  operationId?: unknown;
}): QuickAddRequest | null {
  const { id, quickAdd, operationId } = params;
  if (
    quickAdd !== '1' ||
    typeof id !== 'string' ||
    id.length === 0 ||
    id.length > 120 ||
    /[^A-Za-z0-9_-]/.test(id) ||
    typeof operationId !== 'string' ||
    operationId.length === 0 ||
    operationId.length > 160 ||
    /[^A-Za-z0-9_-]/.test(operationId)
  )
    return null;
  return { taskId: id, operationId: `confirmed-link:${operationId}` };
}
