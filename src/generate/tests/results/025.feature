# Results from: feature-block.test.ts, TST-025: Feature block omits description when overview is null
# State machines:
#  - name: m
#    overview: null
#    states:
#      - name: s
# Covers requirements:
# - [REQ-004] The feature file shall start with a `Feature` block header.
# - [REQ-005] The feature file shall include the state machine overview as an indented description
#   block when present.
# - [REQ-008] The overview shall be omitted when `overview` is `null`.

Feature: m

