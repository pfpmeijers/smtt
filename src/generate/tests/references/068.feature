# Results from: state-trigger-errors.test.ts, TST-068: Circular state-trigger expansion chain raises an error
# State machines:
#  - name: m1
#    states:
#      - name: s1
#    transitions:
#      - trigger:
#          type: state
#          name: s2
#        result:
#          name: s1
#  - name: m2
#    states:
#      - name: s2
#    transitions:
#      - trigger:
#          type: state
#          name: s1
#        result:
#          name: s2
# Covers requirements:
# - [REQ-155] The generator shall detect circular expansion chains (e.g. machine A triggers on state
#   of machine B, machine B triggers on state of machine A) and raise an error.

# Throws: State machine `m1`: Anonymous transition participates in a circular state-trigger expansion chain at trigger `s2` (REQ-155).
