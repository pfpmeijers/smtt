# Results from: state-trigger-expansion.test.ts, TST-075: Recursive state trigger expansion
# State machines:
#  - name: m1
#    states:
#      - name: s1
#    transitions:
#      - trigger:
#          type: event
#          name: e
#        result:
#          name: s1
#        id: "000"
#  - name: m2
#    states:
#      - name: s2
#    transitions:
#      - trigger:
#          type: state
#          name: s1
#        result:
#          name: s2
#        id: "001"
#  - name: m3
#    states:
#      - name: s3
#    transitions:
#      - trigger:
#          type: state
#          name: s2
#        result:
#          name: s3
#        id: "002"
# Covers requirements:
# - [REQ-108] When the source has a state trigger, the expansion shall recurse further into that
#   source until an event trigger is reached.
# - [REQ-146] When expansion recurses (state trigger → state trigger → event trigger), intermediate
#   `Then` steps shall be emitted in chronological causal order: innermost expansion result first,
#   with the top-level result last. Each step renders the result of its own transition, whose
#   references resolve through the bindings of that transition's trigger (REQ-437).

Feature: m3

  Scenario: [002]
    Given initially s3
    And initially s1
    And initially s2
    When e
    Then expect s1
    And expect s2
    And expect s3
