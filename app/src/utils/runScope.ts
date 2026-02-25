const DEFAULT_SCOPE_HIGHLIGHT_THRESHOLD = 80;

export const getRunScopeHighlightThreshold = (runId: number): number => {
  if (typeof window === 'undefined') return DEFAULT_SCOPE_HIGHLIGHT_THRESHOLD;

  const rawValue = window.localStorage.getItem(`run-scope-threshold:${runId}`);
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return DEFAULT_SCOPE_HIGHLIGHT_THRESHOLD;
  return Math.max(0, Math.min(100, parsed));
};

export const setRunScopeHighlightThreshold = (runId: number, threshold: number): number => {
  const normalized = Math.max(0, Math.min(100, threshold));
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(`run-scope-threshold:${runId}`, String(normalized));
  }
  return normalized;
};

export const computeScopeValidated = (total: number, passed: number): number => (
  total > 0 ? (passed / total) * 100 : 0
);

export const getScopeHighlightSx = (scopeValidated: number, threshold: number) => ({
  fontWeight: 700,
  ...(scopeValidated > threshold
    ? {
        bgcolor: 'success.light',
        color: 'success.dark',
        borderRadius: 1,
      }
    : {}),
});

