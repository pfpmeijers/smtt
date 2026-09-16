Feature: m1
  Base machine. Tracks whether a named session is active.

  Scenario Outline: [001] m1 inactive → m1 active with "<a1>"; when e1 with "<a1>"
    Given initially m1 inactive
    When e1 with "<a1>"
    Then expect m1 active with "<a1>"
    Examples:
      | a1 |
      | V1 |

  Scenario Outline: [002] m1 active with "<a1>" → m1 active with "<new a1>"; when e1 with "<new a1>"
    Given initially m1 active with "<a1>"
    When e1 with "<new a1>"
    Then expect m1 active with "<new a1>"
    # Notes: Re-activation under another identifier
    Examples:
      | a1 | new a1 |
      | V1 | V2     |

  Scenario: [003] m1 active → m1 inactive; when e2
    Given initially m1 active
    When e2
    Then expect m1 inactive
