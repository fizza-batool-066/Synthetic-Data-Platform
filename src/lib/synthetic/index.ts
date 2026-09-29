// Barrel export for the synthetic data engine.
export * from "./types";
export * from "./random";
export { generateFromPlan } from "./generate";
export { computeSummary } from "./summary";
export { computeRealism } from "./realism";
export {
  buildTemplate,
  TEMPLATE_NAMES,
  TEMPLATE_LABELS,
} from "./templates";
export type { TemplateName } from "./templates";
