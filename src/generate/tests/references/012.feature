# Results from: conditions-filtering.test.ts, TST-012: Not-as condition filters out text match
# State machines:
#  - name: m
#    states:
#      - name: s
#    dataExampleValues:
#      - a: a1
#      - a: a2
#    transitions:
#      - states:
#          - name: s
#            arguments:
#              - name: a
#                condition:
#                  operator: not as
#                  value: a1
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
# Covers requirements:
# - [REQ-095] The generator shall support text equality forms: `as`, `not as`.

Feature: m

  Scenario Outline: [] s "<a>" → s; when e
    Given initially s "<a>"
    When e
    Then expect s
    Examples:
      | a  |
      | a2 |
