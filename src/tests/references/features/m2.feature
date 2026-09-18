Feature: m2
  Counter machine. Counts items from 0 to 3. Requires `M1 active` to operate.

  Scenario Outline: [004]
    Given initially m1 active
    And initially m2 empty with "<a2>"
    When e3
    Then expect m2 partial with "<incremented a2>"
    Examples:
      | a2 | incremented a2 |
      | 0  | 1              |

  Scenario Outline: [005]
    Given initially m1 active
    And initially m2 partial with "<a2>"
    When e3
    Then expect m2 partial with "<incremented a2>"
    Examples:
      | a2 | incremented a2 |
      | 1  | 2              |

  Scenario Outline: [006] Ceiling reached
    Given initially m1 active
    And initially m2 partial with "<a2>"
    When e3
    Then expect m2 full
    # Notes: Ceiling reached
    Examples:
      | a2 |
      | 2  |

  Scenario Outline: [007]
    Given initially m1 active
    And initially m2 partial with "<a2>"
    When e4
    Then expect m2 partial with "<decremented a2>"
    Examples:
      | a2 | decremented a2 |
      | 2  | 1              |
      | 3  | 2              |

  Scenario Outline: [008]
    Given initially m1 active
    And initially m2 partial with "<a2>"
    When e4
    Then expect m2 empty
    Examples:
      | a2 |
      | 1  |

  Scenario Outline: [009]
    Given initially m1 active
    And initially m2 full with "<a2>"
    When e4
    Then expect m2 partial with "<decremented a2>"
    Examples:
      | a2 | decremented a2 |
      | 3  | 2              |

  Scenario: [010] Counter cleared when M1 deactivates
    Given initially m1 active
    And initially m2 partial
    When e2
    Then expect m1 inactive
    And expect m2 empty
    # Notes: Counter cleared when M1 deactivates

  Scenario: [011] Counter cleared when M1 deactivates
    Given initially m1 active
    And initially m2 full
    When e2
    Then expect m1 inactive
    And expect m2 empty
    # Notes: Counter cleared when M1 deactivates
