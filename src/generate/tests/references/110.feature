# Results from: state-trigger-expansion-data.test.ts, TST-110: A reference-valued result condition does not satisfy a state-trigger argument's own condition
# State machines:
#  - name: m1
#    states:
#      - name: s1
#      - name: s2
#    dataExampleValues:
#      - b: "5"
#    transitions:
#      - states:
#          - name: s1
#            arguments:
#              - name: b
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s2
#          arguments:
#            - name: a
#              condition:
#                operator: =
#                value: b
#                valueIsReference: true
#  - name: m2
#    states:
#      - name: s3
#      - name: s4
#    transitions:
#      - states:
#          - name: s3
#        trigger:
#          type: state
#          name: s2
#          arguments:
#            - name: a
#              condition:
#                operator: =
#                value: "5"
#        result:
#          name: s4
# Covers requirements:
# - [REQ-423] A result condition's `condition.value` may instead be classified as a reference to
#   another attribute of the same machine (`condition.valueIsReference`, set by the parser's
#   post-parse classification step the same way an event trigger is told apart from a state
#   trigger). The `resulting $attribute-name` column's cell value is then taken from that *row's own
#   value* for the referenced attribute, dynamically, instead of the fixed literal REQ-089 otherwise
#   takes it from.

# Throws: State machine `m2`: Anonymous transition has an unresolvable state trigger `s2` — no source transition satisfies the trigger's argument `a` (REQ-118/REQ-164).
