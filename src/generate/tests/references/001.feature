# Results from: arguments-in-label.test.ts, TST-001: Arguments appear in scenario label state names
# State machines:
#  - name: m
#    states:
#      - name: s1
#      - name: s2
#    dataExampleValues:
#      - a1: "1"
#        a2: "2"
#        a3: "3"
#    defaultPreconditions:
#      - state: s3
#        arguments:
#          - qualifier: on
#            name: a3
#    transitions:
#      - states:
#          - name: s1
#            arguments:
#              - qualifier: as
#                name: a1
#        trigger:
#          type: event
#          name: e
#          arguments:
#            - qualifier: with
#              name: ae
#        result:
#          name: s2
#          arguments:
#            - qualifier: from
#              name: a2
#  - name: m0
#    states:
#      - name: s3
# Covers requirements:
# - [REQ-026] Where any state or the trigger carries arguments, those arguments shall be appended to
#   the name inline — see [State Arguments](#state-arguments) for the format.
# - [REQ-027] The inline argument appending shall apply to all name slots in the label:
#   `$original-state-name`, `$trigger`, `$result-state-name`, and the other names within
#   `$context-states`.
# - [REQ-049] The arguments shall be taken from AST paths:

Feature: m

  Scenario Outline: [] s1 as "<a1>" → s2 from "<a2>"; when e with "<ae>"; given s3 on "<a3>"
    Given initially s3 on "<a3>"
    And initially s1 as "<a1>"
    When e with "<ae>"
    Then expect s2 from "<a2>"
    Examples:
      | a3 | a1 | ae | a2 |
      | 3  | 1  |    | 2  |
