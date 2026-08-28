/**
 * Subdirectory name constants shared by `smtt.ts` and all domain runtime modules.
 */

// Directory with input state machine definitions for parse, analyze, renumber and generate.
// Also default directory for parse output.
export const STATE_MACHINES_DIR = "state-machines"

// Output for generate (gherkin).
export const FEATURES_DIR = "features"
export const STEPS_DIR = "steps"  // Output for generate (steps).
export const FIXTURES_DIR = "fixtures"  // Output for generate (fixture stubs).

