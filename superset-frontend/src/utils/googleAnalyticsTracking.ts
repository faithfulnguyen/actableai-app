export const gtagEvent = (
  event_category: string, action: string, event_label: string
) => window.gtag?.('event', action, { event_category, event_label });
