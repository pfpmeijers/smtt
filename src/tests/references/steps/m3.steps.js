import { Given, When, Then } from '../utils'
import * as fixtures from '../fixtures/index.js'

// --- Given ---

// - m3: 013, 015, 016, 018
Given('initially m3 open', async ({ page }) => {
  await fixtures.setM3Open({ page })
})

// - m3: 014, 017, 019
Given('initially m3 paused', async ({ page }) => {
  await fixtures.setM3Paused({ page })
})

// - m3: 012
Given('initially m3 pending with {string}', async ({ page }, a4) => {
  await fixtures.setM3Pending({ page }, a4)
})

// --- When ---

// - m3: 012
When('e5 with {string}', async ({ page }, a3) => {
  await fixtures.makeE5({ page }, a3)
})

// - m3: 013
When('e6', async ({ page }) => {
  await fixtures.makeE6({ page })
})

// - m3: 014
When('e7', async ({ page }) => {
  await fixtures.makeE7({ page })
})

// - m3: 015
When('e8', async ({ page }) => {
  await fixtures.makeE8({ page })
})

// - m3: 016, 017
When('e9', async ({ page }) => {
  await fixtures.makeE9({ page })
})

// --- Then ---

// - m3: 015, 016, 017
Then('expect m3 closed with {string}', async ({ page }, a4) => {
  await fixtures.expectM3Closed({ page }, a4)
})

// - m3: 014, 019
Then('expect m3 open', async ({ page }) => {
  await fixtures.expectM3Open({ page })
})

// - m3: 012
Then('expect m3 open with {string}, {string}', async ({ page }, a3, a4) => {
  await fixtures.expectM3Open({ page }, a3, a4)
})

// - m3: 013, 018
Then('expect m3 paused', async ({ page }) => {
  await fixtures.expectM3Paused({ page })
})

