import { Given, When, Then } from '../utils'
import * as fixtures from '../fixtures/index.js'

// --- Given ---

// 016
Given('initially m2 empty', async ({ page }) => {
  await fixtures.setM2Empty({ page })
})

// 004
Given('initially m2 empty with {string}', async ({ page }, a2) => {
  await fixtures.setM2Empty({ page }, a2)
})

// 011, 015
Given('initially m2 full', async ({ page }) => {
  await fixtures.setM2Full({ page })
})

// 009
Given('initially m2 full with {string}', async ({ page }, a2) => {
  await fixtures.setM2Full({ page }, a2)
})

// 010, 012
Given('initially m2 partial', async ({ page }) => {
  await fixtures.setM2Partial({ page })
})

// 005, 006, 007, 008
Given('initially m2 partial with {string}', async ({ page }, a2) => {
  await fixtures.setM2Partial({ page }, a2)
})

// --- When ---

// 004, 005, 006
When('e3', async ({ page }) => {
  await fixtures.makeE3({ page })
})

// 007, 008, 009
When('e4', async ({ page }) => {
  await fixtures.makeE4({ page })
})

// --- Then ---

// 010, 011
Then('expect m2 empty', async ({ page }) => {
  await fixtures.expectM2Empty({ page })
})

// 008
Then('expect m2 empty with {string}', async ({ page }, resultingA2) => {
  await fixtures.expectM2Empty({ page }, resultingA2)
})

// 006
Then('expect m2 full with {string}', async ({ page }, resultingA2) => {
  await fixtures.expectM2Full({ page }, resultingA2)
})

// 004, 005, 007, 009
Then('expect m2 partial with {string}', async ({ page }, incrementedA2) => {
  await fixtures.expectM2Partial({ page }, incrementedA2)
})

