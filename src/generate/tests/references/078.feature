# Results from: state-trigger-expansion.test.ts, TST-078: Source transition not matched when result arguments differ from trigger arguments
# State machines:
#  - name: m1
#    states:
#      - name: s1
#    dataExampleValues:
#      - a: "1"
#    transitions:
#      - trigger:
#          type: event
#          name: e
#        result:
#          name: s1
#          arguments:
#            - name: a
#              result:
#                value: "1"
#  - name: m2
#    states:
#      - name: s2
#    transitions:
#      - trigger:
#          type: state
#          name: s1
#          arguments:
#            - name: a
#              condition:
#                operator: =
#                value: "2"
#        result:
#          name: s2
# Covers requirements:
# - [REQ-118] A source transition shall only be considered a matching expansion candidate if its
#   result state arguments match the trigger state arguments of the referring transition (the
#   transition being expanded). I.e., the same attribute names shall be referenced, with the same
#   canonical modifier (REQ-085) on both sides — a bare trigger argument only matches a bare result
#   argument, and a modified trigger argument only matches a result argument carrying the same
#   (canonicalized) modifier — AND the source's result shall produce a value that satisfies the
#   referring transition's trigger condition. This shall apply recursively when expansion chains
#   through multiple state triggers.
# - [REQ-164] A state trigger is unresolvable when no transition result matches, or when candidate
#   source transitions exist by result state name but none satisfies REQ-118's argument-matching
#   rule. Then the generator shall raise an error.

# Throws: State machine `m2`: Anonymous transition has an unresolvable state trigger `s1` — no source transition satisfies the trigger's argument `a` (REQ-118/REQ-164).
