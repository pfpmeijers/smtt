# Results from: conditions-filtering.test.ts, TST-176: Reference condition on an attribute absent from the table filters out every row
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataValueCombinations:
#      - a1: "1"
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a1
#                condition:
#                  operator: as
#                  value: a9
#                  valueIsReference: true
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
#        id: "000"
# Covers requirements:
# - [REQ-427] A condition value marked as an attribute reference (`...condition.valueIsReference`,
#   REQ-424 in `smtt.parse.validate.md`) shall not be compared as a literal: for each candidate row,
#   the condition shall be evaluated against the value that row itself holds for the referenced
#   attribute. The same condition can therefore hold for one row and fail for the next. A row that
#   holds no value for the referenced attribute — it has no column for it, or the cell is empty —
#   shall not survive the filter: an absent value pins nothing to compare against.

# Throws: State machine `m`: Empty examples table for transition `000`.
1 candidate row(s) available:
{ a1=1 }.
No row satisfied every condition:
  - `a1` as `a9` (declared on `m`#000)
