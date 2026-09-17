import { Given, When, Then } from '../utils'
import * as fixtures from '../fixtures/index.js'

// --- Given ---

// - m1: 003
// - m2: 004, 005, 006, 007, 008, 009, 010, 011
// - m3: 012, 013, 014, 015, 016, 017, 018
Given('initially m1 active', async ({ page }) => {
  await fixtures.setM1Active({ page })
})

// - m1: 002
Given('initially m1 active with {string}', async ({ page }, a1) => {
  await fixtures.setM1Active({ page }, a1)
})

// - m1: 001
// - m3: 019
Given('initially m1 inactive', async ({ page }) => {
  await fixtures.setM1Inactive({ page })
})

// --- When ---

// - m1: 001, 002
// - m3: 019
When('e1 with {string}', async ({ page }, a1) => {
  await fixtures.makeE1({ page }, a1)
})

// - m1: 003
// - m2: 010, 011
// - m3: 018
When('e2', async ({ page }) => {
  await fixtures.makeE2({ page })
})

// --- Then ---

// - m1: 001, 002
// - m3: 019
Then('expect m1 active with {string}', async ({ page }, a1) => {
  await fixtures.expectM1Active({ page }, a1)
})

// - m1: 003
// - m2: 010, 011
// - m3: 018
Then('expect m1 inactive', async ({ page }) => {
  await fixtures.expectM1Inactive({ page })
})

