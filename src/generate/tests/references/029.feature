# Results from: irrelevant-sections.test.ts, TST-029: Impossible and irrelevant sections are ignored
# State machines:
#  - name: m
#    states:
#      - name: s
#    transitions:
#      - states:
#          - name: s
#        trigger:
#          type: event
#          name: e1
#        result:
#          name: s
#        notes: ""
#    impossible:
#      defined:
#        - states:
#            - s
#          trigger:
#            type: event
#            name: e2
#    irrelevant:
#      - states:
#          - s
#        trigger:
#          type: event
#          name: e3
# Covers requirements:
# - [REQ-147] The impossible and irrelevant sections in the AST shall be treated as informational
#   only and shall be ignored by the feature generator. They shall not produce scenarios or affect
#   scenario generation.

Feature: m

  Scenario: [] s → s; when e1
    Given initially s
    When e1
    Then expect s
