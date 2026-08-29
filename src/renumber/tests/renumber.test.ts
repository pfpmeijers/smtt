import { describe, it } from "node:test"
import * as assert from "node:assert/strict"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"

import { renumber } from "../renumber"
import { assertDirectoriesEqual } from "../../tests/utils/assert"

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const STATE_MACHINES_DIR = path.resolve(currentDir, "state-machines")
const REFERENCES_DIR = path.resolve(currentDir, "references")
const RESULTS_DIR = path.resolve(currentDir, "results")

/**
 * Copies all `*.state-machine.md` files from `sourceDir` into `destDir`.
 *
 * @param sourceDir Source directory containing state machine files.
 * @param destDir Destination directory where files are copied.
 * @returns Map of copied file paths keyed by filename.
 */
function copyStateMachines(sourceDir: string, destDir: string): Map<string, string> {
    fs.mkdirSync(destDir, { recursive: true })
    const copiedPaths = new Map<string, string>()
    for (const entry of fs.readdirSync(sourceDir)) {
        if (!entry.endsWith(".state-machine.md")) {
            continue
        }
        const sourcePath = path.join(sourceDir, entry)
        const destPath = path.join(destDir, entry)
        fs.copyFileSync(sourcePath, destPath)
        copiedPaths.set(entry, destPath)
    }
    return copiedPaths
}

describe("renumber", () => {
    it("adds and rewrites transition IDs in deterministic global order", () => {
        const copiedPaths = copyStateMachines(STATE_MACHINES_DIR, RESULTS_DIR)

        renumber(RESULTS_DIR)

        const alphaStateMachine = fs.readFileSync(copiedPaths.get("alpha.state-machine.md")!, "utf8")
        const betaStateMachine = fs.readFileSync(copiedPaths.get("beta.state-machine.md")!, "utf8")

        // Transition header should include an inserted hash column.
        const headerPattern = /^\s*\|\s*#\s*\|\s*States\s*\|\s*Trigger\s*\|\s*Result\s*\|\s*Notes\s*\|\s*$/m
        assert.match(alphaStateMachine, headerPattern)

        // First transition in alpha machine should have ID 001
        const alphaFirstRowPattern = /^\s*\|\s*001\s*\|\s*`Idle`\s*\|\s*`Start`\s*\|\s*`Active`\s*\|\s*first row\s*\|\s*$/m
        assert.match(alphaStateMachine, alphaFirstRowPattern)

        // Second transition in alpha machine should have ID 002
        const alphaSecondRowPattern = /^\s*\|\s*002\s*\|\s*`Active`\s*\|\s*`Stop`\s*\|\s*`Idle`\s*\|\s*second row\s*\|\s*$/m
        assert.match(alphaStateMachine, alphaSecondRowPattern)

        // Beta machine should have hash column added to header
        assert.match(betaStateMachine, headerPattern)

        // Transition in beta machine should have ID 003 (continuing global count)
        const betaRowPattern = /^\s*\|\s*003\s*\|\s*`Off`\s*\|\s*`Turn on`\s*\|\s*`On`\s*\|\s*stale id\s*\|\s*$/m
        assert.match(betaStateMachine, betaRowPattern)

        assertDirectoriesEqual(RESULTS_DIR, REFERENCES_DIR)
    })
})
