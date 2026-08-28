# Results from: steps-block.test.ts, TST-083: Then step with result state
# State machines:
#  - name: m
#    states:
#      - name: s
#    transitions:
#      - states:
#          - name: s
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
# Covers requirements:
# - [REQ-042] The `Then` step shall be emitted as `Then expect $result-name [$arguments]`.
# - [REQ-043] The result name shall be taken from AST path `[i].transitions[j].result.name`.
# - [REQ-044] The terms `initially` and `expect` shall succeed the `Given` respectively `Then` steps
#   in order to make an additional distinction between step types (`Given`, `When`, `Then`), because
#   a framework mapping the Gherkin steps to code might not support such a distinction (like
#   Playwright's `bddgen` tool).

Feature: m

  Scenario: [] s → s; when e
    Given initially s
    When e
    Then expect s
