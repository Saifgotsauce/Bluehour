// Event partners whose guests get Blue Hour pouches (docs/FUNNEL.md, step 1 and the "after an event" cadence).
// Each pouch card has a QR code to:
//   https://www.bluehournights.com/tried?e=<slug>&code=<code>&utm_source=event&utm_medium=pouch&utm_campaign=<slug>
// The page greets them by event name, applies the event's code, and offers email sign-up for the founding offer.
// code must be a live Founding Crew-type code in Stripe (during the founding offer only Crew codes work at checkout),
// so the event earns its share on every roll bought with it.
//
// Add one line per event. slug: lowercase letters, numbers and dashes only.
export const EVENTS = {
  // 'example-night-dec': { name: 'Example Night', date: 'December 12', code: 'EXAMPLE5' },
};
