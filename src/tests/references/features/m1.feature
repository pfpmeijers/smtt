Feature: m1
  Base machine. Tracks whether a named session is active.

  Scenario Outline: [001] m1 inactive → m1 active with "<a1>"; when e1 with "<a1>"
    Given initially m1 inactive
    When e1 with "<a1>"
    Then expect m1 active with "<a1>"
    Examples:
      | a1 |
      | V1 |
      | V2 |

  Scenario Outline: [002] m1 active with "<a1>" → m1 active with "<different a1>"; when e1 with "<different a1>"
    Given initially m1 active with "<a1>"
    When e1 with "<different a1>"
    Then expect m1 active with "<different a1>"
    # Notes: Re-activation under a different identifier
    Examples:
      | a1 | different a1 |
      | V1 | V2           |
      | V2 | V1           |

  Scenario: [003] m1 active → m1 inactive; when e2
    Given initially m1 active
    When e2
    Then expect m1 inactive
