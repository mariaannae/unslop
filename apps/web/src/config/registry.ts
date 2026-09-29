import { createRegistry } from "../core/registry";
import { createLengthRatioGuardrail } from "../guardrails/lengthRatio";
import { meaningFluencyGuardrail } from "../guardrails/meaningFluency";
import { notEmptyGuardrail } from "../guardrails/notEmpty";
import { createStaticBank } from "../passages/staticBank";
import { createTaskClient } from "../providers/taskClient";
import { noneReferee } from "../referees/none";
import { createLlmBasicScorer } from "../scorers/llmBasic";
import { mockScorer } from "../scorers/mockScorer";

/**
 * Every implementation the app can select by id. Adding a scorer, guardrail,
 * referee, or passage source means one file for it plus one line here.
 */
export const registry = createRegistry({
  scorers: {
    mock: () => mockScorer,
    "llm-basic": () => createLlmBasicScorer(createTaskClient()),
  },
  guardrails: {
    "not-empty": () => notEmptyGuardrail,
    "length-ratio": createLengthRatioGuardrail,
    "meaning-fluency": () => meaningFluencyGuardrail,
  },
  referees: {
    none: () => noneReferee,
  },
  passageSources: {
    "static-bank": () => createStaticBank(),
  },
});
