Feature: m3
  Workflow machine. Tracks a labelled process through its lifecycle. Requires `M1 active` and coordinates with `M2`.

  Scenario Outline: [012] Starting the workflow assigns label and score
    Given initially m1 active
    And initially m2 partial
    And initially m3 pending with "<a4>"
    When e5 with "<a3>"
    Then expect m3 open with "<a3>", "<resulting a4>"
    # Notes: Starting the workflow assigns label and score
    Examples:
      | a4 | a3 | resulting a4 |
      | 0  | P1 | 10           |

  Scenario: [013]
    Given initially m1 active
    And initially m3 open
    When e6
    Then expect m3 paused

  Scenario: [014]
    Given initially m1 active
    And initially m3 paused
    When e7
    Then expect m3 open

  Scenario Outline: [015] Completion requires full M2; score set to max
    Given initially m1 active
    And initially m3 open
    And initially m2 full
    When e8
    Then expect m3 closed with "<resulting a4>"
    # Notes: Completion requires full M2; score set to max
    Examples:
      | resulting a4 |
      | 20           |

  Scenario Outline: [016] Abort from open with empty counter
    Given initially m1 active
    And initially m3 open
    And initially m2 empty
    When e9
    Then expect m3 closed with "<resulting a4>"
    # Notes: Abort from open with empty counter
    Examples:
      | resulting a4 |
      | 0            |

  Scenario Outline: [017] Abort while paused
    Given initially m1 active
    And initially m3 paused
    When e9
    Then expect m3 closed with "<resulting a4>"
    # Notes: Abort while paused
    Examples:
      | resulting a4 |
      | 0            |

  Scenario: [018] Auto-paused when M1 deactivates
    Given initially m1 active
    And initially m3 open
    When e2
    Then expect m1 inactive
    And expect m3 paused
    # Notes: Auto-paused when M1 deactivates

  Scenario Outline: [019] Auto-resumed when M1 reactivates
    Given initially m1 inactive
    And initially m3 paused
    When e1 with "<a1>"
    Then expect m1 active with "<a1>"
    And expect m3 open
    # Notes: Auto-resumed when M1 reactivates
    Examples:
      | a1 |
      | V1 |
