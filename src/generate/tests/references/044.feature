# Results from: modifier-errors.test.ts, TST-044: Modifier without a prior base reference raises an error
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - count: "1"
#    transitions:
#      - states:
#          - name: s
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
#          arguments:
#            - modifier: incremented
#              name: count
#        notes: ""
# Covers requirements:
# - [REQ-136] A modifier on an argument shall be valid only when a base reference to the same
#   attribute exists somewhere in the transition. The generator shall raise an error when no base
#   reference exists.

# Throws: State machine `m`: Invalid modifier `incremented` for attribute `count`: no base reference found in the transition
