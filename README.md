# SMTT: State Machine To Tests

## Overview
SMTT is a specialized architectural tool that bridges the gap between 
**Model-Based Testing (MBT)** and **Behavior-Driven Development (BDD)**. 
It allows developers and QA engineers to define parallel state machines and 
automatically translates them into production-ready Gherkin 
feature files (`Given`/`When`/`Then`) and their underlying step definition 
structures.

By making the formal state machine the single source of truth, SMTT eliminates 
the common pitfalls of manual BDD writing—such as linguistic drift and code
duplication—while providing a robust, highly scalable test automation 
architecture.

---

## Key Problems Addressed by SMTT

### 1. Eliminating "Linguistic Drift" and Code Duplication
Manually defined Gherkin scenarios often suffer from inconsistent phrasing for 
the exact same system state (e.g., "Given the user is logged in" vs. "Given an 
authenticated user"). SMTT standardizes this phrasing automatically based on 
the state machine nodes, maximizing the reuse of underlying step definitions 
across multiple test cases.

### 2. Automated State Cascading
Real-world systems rarely transition one state at a time. SMTT automatically 
handles state cascading—where one transition triggers another, which triggers 
another. It generates the sequential Gherkin steps to accurately reflect these 
multi-tier state changes without requiring manual test authoring.

### 3. Optimizing Test Coverage by Risk Profile
With N-dimensional parallel state machines, SMTT can apply graph-theory-based 
algorithms to generate test suites that match the desired risk profile:
* **State Coverage:** Generate the minimum number of Gherkin scenarios needed 
  to visit every state at least once for smoke testing.
* **Transition Coverage:** Generate scenarios that execute every valid trigger 
  at least once for standard regression coverage.
* **Path or N-Switch Coverage:** Generate scenarios that verify specific 
  sequences of transitions for deep integration testing.

### 4. Taming "Scenario Explosion"
A classic hurdle in parallel state machine testing is the combinatorial 
explosion of possible test paths. SMTT provides mechanisms to control this 
generation tree:
* **Irrelevant Transitions:** Events that are broadcast globally but don't 
  affect specific parallel regions can be flagged as irrelevant, allowing the 
  generator to safely prune them or assert a lack of side effects.
* **Impossible Transitions:** Transitions that break business rules or are 
  physically impossible can be explicitly defined or automatically inferred. 
  This prevents the generation of "dumb" combinatorial tests and naturally 
  scopes out negative testing boundaries.

---

## Data-Driven Testing & Modifiers

State machines in SMTT aren't just structural; they are data-aware.

Data attributes defined in the state machine (used as arguments in precondition 
states, trigger functions, and resulting states) are seamlessly forwarded 
through the entire execution chain (State transitions → Scenario → Step → 
Fixture → Helper → Code under test).

**Dynamic Scenario Outlines:**
SMTT utilizes modifiers and conditions applied to transition arguments to 
automatically generate columns in the scenario outline's data example tables, 
i.e., automating combinatorial test data generation.

---

## Execution Architecture: The 3-Tier "Generation Gap" Pattern

Code generation tools typically face the challenge to not overwrites manual 
customizations. SMTT prevents the "overwrite dilemma" by employing a strict 
3-tier architecture (combining the Generation Gap and Adapter patterns):

1. **Auto-Generated Step Functions (Strict & Disposable):**
   These functions map exactly to the Gherkin syntax. They are strictly 
   read-only, never manually modified, and can be regenerated thousands of 
   times. They simply pass the state and data attributes down the chain.

2. **The Adapter Layer (Fixture Prototypes):**
   SMTT automatically generates fixture prototypes. These act as an 
   anti-corruption layer. The user manually maps these fixtures to their 
   underlying helper functions. They contain no actual testing logic, only 
   routing.

3. **The Implementation Layer (Manual Helper Functions):**
   This is where the actual automation logic and system interactions live. 
   Because they are decoupled from the Gherkin phrasing, these helpers 
   can be modular and reusable.

---

## Summary of Workflow

1. **Model:** Define states, data attributes and transitions
   using SMTT's state machine definition format. Define impossible/irrelevant 
   transition paths.
   - See `docs/sm.spec.md` for a non-formal description of the state machine
     definition format (a `*.state-machnine.md` file).
   - See `docs/sm.ohm` for the formal grammar specification.
2. **Parse**: Use the SMTT tool to verify the state machine definitions.
   - See `smtt parse --help` for more info.
3. **Analyze**: Use the SMTT tool to analyze the state machines and infer 
   impossible transition paths and other characteristics. Make adjustments to 
   the state machine definitions when necessary.
   - See `smtt generate --help` for more info.
4. **Generate Gherkin & Steps:** Use SMTT tool to output standardized Gherkin 
   feature files with populated `Examples` tables, and read-only step functions.
   - See `smtt generate --help` for more info.
5. **Implement:** Write or generate the reusable helper functions to execute
   the test logic against the System Under Test.
6. **Map:** SMTT generates fixture prototypes. Manually map these fixtures 
   to underlying helper functions.
7. **Generate Tests**: Use a BDD framework to generate the final test cases 
   from the Gherkin scenarios and step definitions.
8. **Execute:** Run the generated Gherkin scenarios.
