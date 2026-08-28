# Results from: steps-block.test.ts, TST-079: Given steps use Given then And keywords
# State machines:
#  - name: m
#    states:
#      - name: s1
#    defaultPreconditions:
#      - state: s2
#    transitions:
#      - states:
#          - name: s1
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s1
#  - name: m2
#    states:
#      - name: s2
# Covers requirements:
# - [REQ-032] All states shall be translated into precondition steps:
# - [REQ-035] The precondition steps shall be emitted in effective state array order (injected
#   default preconditions first, explicit transition states after).
# - [REQ-038] The default precondition states and their names shall be taken from AST path
#   `[i].defaultPreconditions[*].state`.
# - [REQ-039] The transition specific states and their names shall be taken from AST path
#   `[i].transitions[j].states[*].name`.
# - [REQ-044] The terms `initially` and `expect` shall succeed the `Given` respectively `Then` steps
#   in order to make an additional distinction between step types (`Given`, `When`, `Then`), because
#   a framework mapping the Gherkin steps to code might not support such a distinction (like
#   Playwright's `bddgen` tool).

Feature: m

  Scenario: [] s1 → s1; when e; given s2
    Given initially s2
    And initially s1
    When e
    Then expect s1
