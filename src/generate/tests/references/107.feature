# Results from: modifier-errors.test.ts, TST-107: 'different' modifier with only an undefined value found reports it as `<undefined>`
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: ""
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

# Throws: State machine `m`: Anonymous transition: Invalid modifier `different` for attribute `a` on result `s`: expected at least two distinct values but found 1 (<undefined>)
