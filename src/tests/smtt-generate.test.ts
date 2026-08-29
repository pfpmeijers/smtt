import { describe, it } from "node:test"
import * as assert from "node:assert/strict"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "child_process"
import { assertDirectoriesEqual, normalizeSourcePathsInJson } from "./utils/assert"

// Resolve __dirname for ES modules.
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Test the smtt generate command end-to-end.
 * Validates that the generate command produces features, steps, and fixtures output.
 */

describe("SMTT Generate Command", () => {
	const testDir = __dirname
	const inputDir = path.resolve(testDir, "state-machines")
	const resultsDir = path.resolve(testDir, "results")
	const referencesDir = path.resolve(testDir, "references")
	const astFile = path.join(resultsDir, "sm.ast.json")
	const smttScript = path.resolve(testDir, "../smtt.ts")

	it("generates features, steps, and fixtures from state-machines directory", () => {
		// Ensure results directory exists.
		if (!fs.existsSync(resultsDir)) {
			fs.mkdirSync(resultsDir, { recursive: true })
		}

		// Ensure references directory exists.
		if (!fs.existsSync(referencesDir)) {
			fs.mkdirSync(referencesDir, { recursive: true })
		}

		// Check that input directory exists.
		assert.ok(fs.existsSync(inputDir), `Input directory exists: \`${inputDir}\``)

		// Run the smtt generate command without relying on a shell PATH lookup for the local tsx binary.
		const args = [
			"--import",
			"tsx",
			smttScript,
			"generate",
			"--input-dir",
			inputDir,
			"--ast-file",
			astFile,
			"--output-dir",
			resultsDir,
		]

		try {
			execFileSync(process.execPath, args, { cwd: testDir, stdio: "inherit" })
		} catch (error) {
			assert.fail(`smtt generate command failed: ${error instanceof Error ? error.message : String(error)}`)
		}

		// Validate that the AST file was created.
		assert.ok(fs.existsSync(astFile), `AST file created: \`${astFile}\``)

		// Validate that features directory was created with feature files.
		const featuresDir = path.join(resultsDir, "features")
		assert.ok(fs.existsSync(featuresDir), `Features directory created: \`${featuresDir}\``)

		const featureFiles = fs.readdirSync(featuresDir).filter(file => file.endsWith(".feature"))
		assert.ok(featureFiles.length > 0, `Feature files generated (found ${featureFiles.length})`)

		// Validate that steps directory was created with step files.
		const stepsDir = path.join(resultsDir, "steps")
		assert.ok(fs.existsSync(stepsDir), `Steps directory created: \`${stepsDir}\``)

		const stepFiles = fs.readdirSync(stepsDir).filter(file => file.endsWith(".steps.js"))
		assert.ok(stepFiles.length > 0, `Step files generated (found ${stepFiles.length})`)

		// Validate that fixtures directory was created with fixture files.
		const fixturesDir = path.join(resultsDir, "fixtures")
		assert.ok(fs.existsSync(fixturesDir), `Fixtures directory created: \`${fixturesDir}\``)

		const fixtureFiles = fs.readdirSync(fixturesDir).filter(file => file.endsWith(".fixtures.js"))
		assert.ok(fixtureFiles.length > 0, `Fixture files generated (found ${fixtureFiles.length})`)

		// Normalize absolute `source` paths in AST snapshots before comparison.
		assertDirectoriesEqual(resultsDir, referencesDir, (relativeFile, content) => {
			if (relativeFile === "sm.ast.json") {
				return normalizeSourcePathsInJson(content)
			}

			return content
		})

		console.log(`Generated test artifacts: ${featureFiles.length} features, ${stepFiles.length} steps, ${fixtureFiles.length} fixtures`)
	})
})

