# Results from: conditions-result.test.ts, TST-086: Result conditions shall be restricted to equality operators only
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: "1"
#    transitions:
#      - trigger:
#          type: event
#          name: e
#        result:
#          name: s
#          arguments:
#            - name: a
#              condition:
#                operator: not as
#                value: "2"
# Covers requirements:
# - [REQ-089] Result conditions shall be restricted to equality operators only (`=`, `as`). The
#   `resulting $attribute-name` column cell value shall be taken directly from `condition.value` in
#   the AST. The generator shall raise an error when a result condition uses a non-equality
#   operator.

# Throws: Invalid result condition for attribute "a": operator "not as" is not supported. Result conditions only allow "=" or "as" (REQ-089).
