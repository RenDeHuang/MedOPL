import registry from "./portalJourneyRegistry.json";

export type PortalJourneyId = (typeof registry.journeys)[number]["id"];
export type PortalJourneyRoute = keyof typeof registry.routes;
export type PortalJourney = (typeof registry.journeys)[number];

export const portalJourneyRegistry = registry;

export function journeysForRoute(route: PortalJourneyRoute): PortalJourneyId[] {
  return [...registry.routes[route]] as PortalJourneyId[];
}

export function journeyById(journeyId: PortalJourneyId): PortalJourney {
  const journey = registry.journeys.find((item) => item.id === journeyId);
  if (!journey) throw new Error(`portal_journey_missing:${journeyId}`);
  return journey;
}
