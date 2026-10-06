let sequence = 0;

export function generateId(prefix = 'id'): string {
  sequence = (sequence + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}_${sequence.toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}
