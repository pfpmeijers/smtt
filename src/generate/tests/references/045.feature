# Results from: modifier-errors.test.ts, TST-045: 'different' modifier with fewer than two distinct values raises an error
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: only
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
#          arguments:
#            - modifier: different
#              name: a
#        notes: ""
# Covers requirements:
# - [REQ-141] The generator shall raise an error when the value pool for a `not`/`other`/`different`
#   modifier contains fewer than two distinct values for the referenced attribute. The parser should
#   validate this precondition.

# Throws: State machine `m`: Invalid modifier `different` for attribute `a`: expected at least two distinct values but found 1
