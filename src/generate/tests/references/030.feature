# Results from: irrelevant-sections.test.ts, TST-030: Metadata fields (source path/line) are not used in generation
# State machines:
#  - name: m
#    source: /some/secret/path.md
#    states:
#      - name: s
#        sourceLine: 42
#    transitions:
#      - states:
#          - name: s
#        trigger:
#          type: event
#          name: e
#        result:
#          name: s
#        notes: ""
#        sourceLine: 7
#        id: "000"
# Covers requirements:
# - [REQ-149] Metadata fields (source file path, source line number) in the AST shall not be used in
#   feature generation.

Feature: m

  Scenario: [000]
    Given initially s
    When e
    Then expect s
