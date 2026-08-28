# Results from: modifier-errors.test.ts, TST-043: incremented modifier on a non-numeric value raises an error
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: foo
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
#            - modifier: incremented
#              name: a
#        notes: ""
# Covers requirements:
# - [REQ-080] The parser component shall verify that these modifiers are applied to numerical
#   values.

# Throws: Invalid modifier "incremented" for attribute "a": expected a numeric value but got "foo"
