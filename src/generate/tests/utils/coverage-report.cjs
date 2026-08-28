/**
 * Coverage reporter: maps every [REQ-nnn] in
 * docs/smtt.generate.features.md to the TST-nnn cases that claim it.
 * Run from tests/smtt:  node src/generate/tests/utils/coverage-report.cjs
 */
const fs = require("fs")
const path = require("path")

const root = path.resolve(__dirname, "..", "..", "..", "..")
const spec = fs.readFileSync(path.join(root, "docs", "smtt.generate.features.md"), "utf8")
const all = [...new Set([...spec.matchAll(/\[REQ-(\d{3})\]/g)].map((m) => m[1]))].sort()

const dir = path.resolve(__dirname, "..")
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".test.ts"))

const cov = {}
const tests = []
for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), "utf8")
    for (const m of text.matchAll(/test\("(\[TST-(\d+)\][^"]*)"/g)) {
        const title = m[1]
        const id = m[2]
        // Titles use the shorthand `[REQ-009/011/013]` for multiple requirements.
        const reqs = [...title.matchAll(/REQ-((?:\d{3})(?:\/\d{3})*)/g)]
            .flatMap((x) => x[1].split("/"))
        tests.push({ id, file: f, title, reqs })
        for (const r of reqs) (cov[r] = cov[r] || []).push("TST-" + id)
    }
}

const uncovered = all.filter((r) => !cov[r])
const bogus = Object.keys(cov).filter((r) => !all.includes(r)).sort()
const ids = tests.map((t) => +t.id).sort((a, b) => a - b)
const gaps = []
for (let i = 1; i <= Math.max(...ids); i++) if (!ids.includes(i)) gaps.push(i)

console.log("Test count:", tests.length)
console.log("Total requirements:", all.length)
console.log("Covered:", all.length - uncovered.length)
console.log("Uncovered:", uncovered.map((r) => r).join(", "))
console.log("Claimed requirements not in spec:", bogus.map((r) => r).join(", "))
console.log("Tests without requirements:", tests.filter((t) => t.reqs.length === 0).map((t) => t.id).join(", "))
console.log("Unused test IDs:", gaps.join(", "))


