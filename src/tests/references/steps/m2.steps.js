import { Given, When, Then } from '../utils'
import * as fixtures from '../fixtures/index.js'

// --- Given ---

// - m3: 016
Given('initially m2 empty', async ({ page }) => {
  await fixtures.setM2Empty({ page })
})

// - m2: 004
Given('initially m2 empty with {string}', async ({ page }, a2) => {
  await fixtures.setM2Empty({ page }, a2)
})

// - m2: 011
// - m3: 015
Given('initially m2 full', async ({ page }) => {
  await fixtures.setM2Full({ page })
})

// - m2: 009
Given('initially m2 full with {string}', async ({ page }, a2) => {
  await fixtures.setM2Full({ page }, a2)
})

// - m2: 010
// - m3: 012
Given('initially m2 partial', async ({ page }) => {
  await fixtures.setM2Partial({ page })
})

// - m2: 005, 006, 007, 008
Given('initially m2 partial with {string}', async ({ page }, a2) => {
  await fixtures.setM2Partial({ page }, a2)
})

// --- When ---

// - m2: 004, 005, 006
When('e3', async ({ page }) => {
  await fixtures.makeE3({ page })
})

// - m2: 007, 008, 009
When('e4', async ({ page }) => {
  await fixtures.makeE4({ page })
})

// --- Then ---

// - m2: 008, 010, 011
Then('expect m2 empty', async ({ page }) => {
  await fixtures.expectM2Empty({ page })
})

// - m2: 006
Then('expect m2 full', async ({ page }) => {
  await fixtures.expectM2Full({ page })
})

// - m2: 004, 005, 007, 009
Then('expect m2 partial with {string}', async ({ page }, incrementedA2) => {
  await fixtures.expectM2Partial({ page }, incrementedA2)
})

