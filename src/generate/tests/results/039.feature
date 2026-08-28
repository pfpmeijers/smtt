# Results from: layout.test.ts, TST-039: Blank line after Feature block before first Scenario
# State machines:
#  - name: m
#    states:
#      - name: s
#    transitions:
#      - states:
#          - name: s
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
# Covers requirements:
# - [REQ-127] One blank line shall be emitted after the `Feature:` block (header + optional
#   description) before the first `Scenario:`.

Feature: m

  Scenario: [] s → s; when e
    Given initially s
    When e
    Then expect s
