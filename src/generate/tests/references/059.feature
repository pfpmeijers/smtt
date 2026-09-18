# Results from: scenario-label.test.ts, TST-059: Scenario label is the transition id and description
# State machines:
#  - name: m
#    states:
#      - name: s1
#      - name: s2
#    defaultPreconditions:
#      - state: s3
#    transitions:
#      - id: "001"
#        states:
#          - name: s1
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s2
#        notes: Cart hold expires
#  - name: m0
#    states:
#      - name: s3
# Covers requirements:
# - [REQ-009] The generator shall write one or more scenarios per transition with the following
#   label:
# - [REQ-010] The transition shall be taken from AST path `[i].transitions[j]`.
# - [REQ-011] The label shall include `[$id]`, the transition id.
# - [REQ-012] The `$id` shall be taken from AST path `[i].transitions[j].id`.
# - [REQ-451] The label shall include ` $description`, the transition description, following the id.
# - [REQ-452] The `$description` shall be taken from AST path `[i].transitions[j].notes`, verbatim:
#   it is not lower cased and its placeholders are not rewritten.

Feature: m

  Scenario: [001] Cart hold expires
    Given initially s3
    And initially s1
    When e
    Then expect s2
    # Notes: Cart hold expires
