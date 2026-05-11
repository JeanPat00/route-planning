import { runHeuristicOptimization } from "./solvers/heuristicOptimizer.js";

export function optimizeScenario(scenario, helpers) {
  return runHeuristicOptimization(scenario, helpers);
}
