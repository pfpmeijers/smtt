Feature: m2
  Counter machine. Counts items from 0 to 3. Requires `M1 active` to operate.

  Scenario Outline: [004] m2 empty with "<a2>" → m2 partial with "<incremented a2>"; when e3; given m1 active
    Given initially m1 active
    And initially m2 empty with "<a2>"
    When e3
    Then expect m2 partial with "<incremented a2>"
    Examples:
      | a2 | incremented a2 |
      | 0  | 1              |
      | 0  | 1              |

  Scenario Outline: [005] m2 partial with "<a2>" → m2 partial with "<incremented a2>"; when e3; given m1 active
    Given initially m1 active
    And initially m2 partial with "<a2>"
    When e3
    Then expect m2 partial with "<incremented a2>"
    Examples:
      | a2 | incremented a2 |
      | 1  | 2              |
      | 1  | 2              |

  Scenario Outline: [006] m2 partial with "<a2>" → m2 full with "<resulting a2>"; when e3; given m1 active
    Given initially m1 active
    And initially m2 partial with "<a2>"
    When e3
    Then expect m2 full with "<resulting a2>"
    # Notes: Ceiling reached
    Examples:
      | a2 | resulting a2 |
      | 2  | 3            |
      | 2  | 3            |

  Scenario Outline: [007] m2 partial with "<a2>" → m2 partial with "<decremented a2>"; when e4; given m1 active
    Given initially m1 active
    And initially m2 partial with "<a2>"
    When e4
    Then expect m2 partial with "<decremented a2>"
    Examples:
      | a2 | decremented a2 |
      | 2  | 1              |
      | 2  | 1              |
      | 3  | 2              |
      | 3  | 2              |

  Scenario Outline: [008] m2 partial with "<a2>" → m2 empty with "<resulting a2>"; when e4; given m1 active
    Given initially m1 active
    And initially m2 partial with "<a2>"
    When e4
    Then expect m2 empty with "<resulting a2>"
    Examples:
      | a2 | resulting a2 |
      | 1  | 0            |
      | 1  | 0            |

  Scenario Outline: [009] m2 full with "<a2>" → m2 partial with "<decremented a2>"; when e4; given m1 active
    Given initially m1 active
    And initially m2 full with "<a2>"
    When e4
    Then expect m2 partial with "<decremented a2>"
    Examples:
      | a2 | decremented a2 |
      | 3  | 2              |
      | 3  | 2              |

  Scenario: [010] m2 partial → m2 empty; when m1 inactive; given m1 active
    Given initially m1 active
    And initially m2 partial
    When e2
    Then expect m1 inactive
    And expect m2 empty
    # Notes: Counter cleared when M1 deactivates

  Scenario: [011] m2 full → m2 empty; when m1 inactive; given m1 active
    Given initially m1 active
    And initially m2 full
    When e2
    Then expect m1 inactive
    And expect m2 empty
    # Notes: Counter cleared when M1 deactivates
