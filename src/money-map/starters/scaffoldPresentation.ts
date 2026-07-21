import type { MoneyMapDocument, PresentationStep } from "../model/types";

export function withScaffoldPresentation(
  document: Omit<MoneyMapDocument, "presentation">,
  titles: readonly string[],
): MoneyMapDocument {
  const overview: PresentationStep = {
    id: "overview",
    title: "Overview",
    moduleIds: document.modules.map(({ id }) => id),
    flowIds: document.flows.map(({ id }) => id),
  };
  const focusSteps = titles.map((title, index): PresentationStep => {
    const flow = document.flows[index % document.flows.length];
    return {
      id: `${document.id}-step-${index + 1}`,
      title,
      moduleIds: [flow.source, flow.target],
      flowIds: [flow.id],
    };
  });
  return { ...document, presentation: [overview, ...focusSteps] };
}
