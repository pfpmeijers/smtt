# Results from: conditions-filtering.test.ts, TST-014: All rows filtered out raises error
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: "0"
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a
#                condition:
#                  operator: ">"
#                  value: "5"
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
# Covers requirements:
# - [REQ-099] Arguments shall result in filtering out certain examples in the scenario.
# - [REQ-100] If all rows are filtered out, the generator shall raise an error — an empty examples
#   table is not valid.

# Throws: Empty examples table for transition undefined in state machine m
