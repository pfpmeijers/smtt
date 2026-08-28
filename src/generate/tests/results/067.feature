# Results from: state-trigger-errors.test.ts, TST-067: Ambiguous state name across machines raises an error
# State machines:
#  - name: m1
#    states:
#      - name: s
#  - name: m2
#    states:
#      - name: s
# Covers requirements:
# - [REQ-154] The generator shall raise an error if a state name lookup is ambiguous (i.e. the same
#   state name appears in multiple machines). The parser's validate step enforces uniqueness, so
#   this serves as an internal assertion.

# Throws: Ambiguous state name lookup: duplicate state names across machines: s (REQ-154).
