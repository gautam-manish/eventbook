export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
export function dateParts(iso: string) {
  const d = new Date(iso);
  return { month: d.toLocaleString([], { month: 'short' }), day: d.getDate() };
}
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { timeStyle: 'short' });
}