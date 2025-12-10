
const fs = require('fs');

const report = JSON.parse(fs.readFileSync('coverage/vitest-report.json', 'utf8'));

// The format of coverageMap is:
// { "path/to/file": { "path": "path/to/file", "s": { "0": 1, ... }, "statementMap": { "0": { ... }, ... } } }
// We can access it via report.coverageMap

if (!report.coverageMap) {
  console.log("No coverage map found in the report.");
  process.exit(1);
}

const coverage = report.coverageMap;

const fileCoverages = [];

for (const filePath in coverage) {
  const fileData = coverage[filePath];
  const statements = fileData.s;
  const statementMap = fileData.statementMap;

  let totalStatements = 0;
  let coveredStatements = 0;

  for (const key in statements) {
    totalStatements++;
    if (statements[key] > 0) {
      coveredStatements++;
    }
  }

  const percentage = totalStatements === 0 ? 100 : (coveredStatements / totalStatements) * 100;

  fileCoverages.push({
    filePath: filePath,
    percentage: percentage,
    total: totalStatements,
    covered: coveredStatements
  });
}

// Sort by percentage (ascending)
fileCoverages.sort((a, b) => a.percentage - b.percentage);

console.log("Files with lowest coverage:");
fileCoverages.slice(0, 20).forEach(file => {
  console.log(`${file.filePath}: ${file.percentage.toFixed(2)}% (${file.covered}/${file.total})`);
});
