# Results from: conditions-filtering.test.ts, TST-015: Empty value on a non-undefined operator is rejected
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: "1"
#      - a: ""
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a
#                condition:
#                  operator: =
#                  value: ""
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
# Covers requirements:
# - [REQ-075] Empty strings shall not match any comparison operator except `undefined`.

# Throws: Invalid condition for attribute "a": operator "=" cannot be used with an empty value. Use { operator: "undefined" } to match absent/empty values instead.
