# Results from: empty-attribute-values.test.ts, TST-022: Arguments referenced with no dataExampleValues table raises error
# State machines:
#  - name: m
#    states:
#      - name: s
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
# Covers requirements:
# - [REQ-157] The generator shall raise an error when arguments are referenced in a transition
#   (directly or indirectly) but the state machine's `$example-data-values` table is absent or empty
#   after row filtering.

# Throws: Invalid state machine "m": anonymous transition references argument(s), but the state machine's dataExampleValues table is empty or absent (REQ-157/REQ-163).
