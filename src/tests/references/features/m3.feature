Feature: m3
  Workflow machine. Tracks a labelled process through its lifecycle. Requires `M1 active` and coordinates with `M2`.

  Scenario Outline: [012] m3 pending with "<a4>" → m3 open with "<a3>", "<resulting a4>"; when e5 with "<a3>"; given m1 active, m2 partial
    Given initially m1 active
    And initially m2 partial
    And initially m3 pending with "<a4>"
    When e5 with "<a3>"
    Then expect m3 open with "<a3>", "<resulting a4>"
    # Notes: Starting the workflow assigns label and score
    Examples:
      | a4 | a3 | resulting a4 |
      | 0  | P1 | 10           |

  Scenario: [013] m3 open → m3 paused; when e6; given m1 active
    Given initially m1 active
    And initially m3 open
    When e6
    Then expect m3 paused

  Scenario: [014] m3 paused → m3 open; when e7; given m1 active
    Given initially m1 active
    And initially m3 paused
    When e7
    Then expect m3 open

  Scenario Outline: [015] m3 open → m3 closed with "<resulting a4>"; when e8; given m1 active, m2 full
    Given initially m1 active
    And initially m3 open
    And initially m2 full
    When e8
    Then expect m3 closed with "<resulting a4>"
    # Notes: Completion requires full M2; score set to max
    Examples:
      | a4 | resulting a4 |
      | 10 | 20           |
      | 20 | 20           |

  Scenario Outline: [016] m3 open → m3 closed with "<resulting a4>"; when e9; given m1 active, m2 empty
    Given initially m1 active
    And initially m3 open
    And initially m2 empty
    When e9
    Then expect m3 closed with "<resulting a4>"
    # Notes: Abort from open with empty counter
    Examples:
      | a4 | resulting a4 |
      | 10 | 0            |
      | 20 | 0            |

  Scenario Outline: [017] m3 paused → m3 closed with "<resulting a4>"; when e9; given m1 active
    Given initially m1 active
    And initially m3 paused
    When e9
    Then expect m3 closed with "<resulting a4>"
    # Notes: Abort while paused
    Examples:
      | a4 | resulting a4 |
      | 0  | 0            |
      | 10 | 0            |
      | 20 | 0            |

  Scenario: [018] m3 open → m3 paused; when m1 inactive; given m1 active
    Given initially m1 active
    And initially m3 open
    When e2
    Then expect m1 inactive
    And expect m3 paused
    # Notes: Auto-paused when M1 deactivates

  Scenario Outline: [019] m3 paused → m3 open; when m1 active with "<a1>"; given m1 inactive
    Given initially m1 inactive
    And initially m3 paused
    When e1 with "<a1>"
    Then expect m1 active with "<a1>"
    And expect m3 open
    # Notes: Auto-resumed when M1 reactivates
    Examples:
      | a1 |
      | V1 |
      | V2 |
