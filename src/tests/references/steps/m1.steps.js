import { Given, When, Then } from '../utils'
import * as fixtures from '../fixtures/index.js'

// --- Given ---

// 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 014, 015, 016, 017, 018
Given('initially m1 active', async ({ page }) => {
  await fixtures.setM1Active({ page })
})

// 002
Given('initially m1 active with {string}', async ({ page }, a1) => {
  await fixtures.setM1Active({ page }, a1)
})

// 001, 019
Given('initially m1 inactive', async ({ page }) => {
  await fixtures.setM1Inactive({ page })
})

// --- When ---

// 001, 002, 019
When('e1 with {string}', async ({ page }, a1) => {
  await fixtures.makeE1({ page }, a1)
})

// 003, 010, 011, 018
When('e2', async ({ page }) => {
  await fixtures.makeE2({ page })
})

// --- Then ---

// 001, 002, 019
Then('expect m1 active with {string}', async ({ page }, a1) => {
  await fixtures.expectM1Active({ page }, a1)
})

// 003, 010, 011, 018
Then('expect m1 inactive', async ({ page }) => {
  await fixtures.expectM1Inactive({ page })
})

