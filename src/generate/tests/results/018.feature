# Results from: default-precondition-modifier.test.ts, TST-018: Default precondition modifier references a base value in the transition
# State machines:
#  - name: m1
#    states:
#      - name: s1
#  - name: m2
#    states:
#      - name: s2
#    dataExampleValues:
#      - count: "1"
#      - count: "2"
#    defaultPreconditions:
#      - state: s1
#        arguments:
#          - modifier: incremented
#            name: count
#    transitions:
#      - states:
#          - name: s2
#            arguments:
#              - name: count
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s2
#        notes: ""
# Covers requirements:
# - [REQ-156] When a default precondition argument carries a modifier, the modifier shall reference
#   the base value of the same attribute as encountered in the specific transition it is injected
#   into. If no base reference exists in the transition, the generator shall raise an error.

Feature: m2

  Scenario Outline: [] s2 "<count>" → s2; when e; given s1 "<incremented count>"
    Given initially s1 "<incremented count>"
    And initially s2 "<count>"
    When e
    Then expect s2
    Examples:
      | count | incremented count |
      | 1     | 2                 |
      | 2     | 3                 |
