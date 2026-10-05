export type AnalyticsEvent = { name: 'public_home_opened' };
export interface AnalyticsService {
  track(event: AnalyticsEvent): void;
}
// Intentionally has no SDK, console, identifiers, or answer-content sink.
export const noOpAnalytics: AnalyticsService = { track: () => undefined };
