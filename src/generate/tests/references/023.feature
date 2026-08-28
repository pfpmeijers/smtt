# Results from: feature-block.test.ts, TST-023: Feature file per state machine
# State machines:
#  - name: m 1
#    states:
#      - name: s
# Covers requirements:
# - [REQ-001] The generator shall write one feature file per state machine in the AST file.
# - [REQ-002] The feature file shall be named `features/$state-machine-name.feature`.
# - [REQ-003] The `$state-machine-name` shall be taken from AST path `[i].name`.
# - [REQ-131] The file name `$state-machine-name` shall have remaining internal whitespace replaced
#   by hyphens (`-`).

Feature: m 1

