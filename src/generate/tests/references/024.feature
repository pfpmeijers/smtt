# Results from: feature-block.test.ts, TST-024: Feature block includes overview when present
# State machines:
#  - name: m
#    states:
#      - name: s
#    overview: Manages shopping cart lifecycle
# Covers requirements:
# - [REQ-004] The feature file shall start with a `Feature` block header.
# - [REQ-005] The feature file shall include the state machine overview as an indented description
#   block when present.
# - [REQ-006] The `$overview` shall be taken from AST path `[i].overview`.

Feature: m
  Manages shopping cart lifecycle

