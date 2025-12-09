#!/usr/bin/env node
/**
 * Test Rigor Audit Script
 * 
 * Scans test files for anti-patterns defined in TEST_RIGOR_GUIDELINES.md:
 * - toBeTruthy() / toBeDefined() without content assertions
 * - waitFor without fake timers
 * - Mocking the SUT (system under test)
 * 
 * Usage: node scripts/audit-test-rigor.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TESTS_DIR = path.join(__dirname, '..', 'tests');

// Anti-pattern definitions
const ANTI_PATTERNS = [
  {
    name: 'toBeTruthy (fluffy assertion)',
    pattern: /expect\([^)]+\)\.toBeTruthy\(\)/g,
    severity: 'warning',
    fix: 'Replace with strict equality: expect(x).toBe(expectedValue) or expect(x).toEqual(expectedObject)',
  },
  {
    name: 'toBeDefined (fluffy assertion)',
    pattern: /expect\([^)]+\)\.toBeDefined\(\)/g,
    severity: 'warning',
    fix: 'Replace with content assertion: expect(x).toEqual(expectedValue)',
  },
  {
    name: 'waitFor without useFakeTimers',
    pattern: /waitFor\s*\(/g,
    severity: 'info',
    fix: 'Consider using vi.useFakeTimers() and vi.advanceTimersByTimeAsync() for determinism',
    requiresContext: true, // Need to check if file uses fake timers
  },
  {
    name: 'createMockEditor (mocking SUT)',
    pattern: /createMockEditor/g,
    severity: 'error',
    fix: 'Use real library instances or behavioral mocks that simulate actual behavior',
  },
];

function findTestFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      files.push(...findTestFiles(fullPath));
    } else if (entry.isFile() && /\.test\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function auditFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(TESTS_DIR, filePath);
  const issues = [];
  
  const usesFakeTimers = /useFakeTimers/.test(content);
  
  for (const antiPattern of ANTI_PATTERNS) {
    const matches = content.match(antiPattern.pattern) || [];
    
    if (matches.length > 0) {
      // Special handling for waitFor - only flag if no fake timers
      if (antiPattern.requiresContext && usesFakeTimers) {
        continue;
      }
      
      issues.push({
        file: relativePath,
        pattern: antiPattern.name,
        count: matches.length,
        severity: antiPattern.severity,
        fix: antiPattern.fix,
      });
    }
  }
  
  return issues;
}

function main() {
  console.log('🔍 Test Rigor Audit\n');
  console.log('Scanning test files for anti-patterns...\n');
  
  const testFiles = findTestFiles(TESTS_DIR);
  const allIssues = [];
  
  for (const file of testFiles) {
    const issues = auditFile(file);
    allIssues.push(...issues);
  }
  
  // Group by severity
  const bySevertiy = {
    error: allIssues.filter(i => i.severity === 'error'),
    warning: allIssues.filter(i => i.severity === 'warning'),
    info: allIssues.filter(i => i.severity === 'info'),
  };
  
  // Summary
  console.log('=' .repeat(60));
  console.log('SUMMARY');
  console.log('=' .repeat(60));
  console.log(`Total files scanned: ${testFiles.length}`);
  console.log(`Files with issues: ${new Set(allIssues.map(i => i.file)).size}`);
  console.log(`Total issues: ${allIssues.length}`);
  console.log(`  🔴 Errors: ${bySevertiy.error.length}`);
  console.log(`  🟡 Warnings: ${bySevertiy.warning.length}`);
  console.log(`  🔵 Info: ${bySevertiy.info.length}`);
  console.log();
  
  // Details by pattern
  const byPattern = {};
  for (const issue of allIssues) {
    if (!byPattern[issue.pattern]) {
      byPattern[issue.pattern] = { count: 0, files: [], fix: issue.fix };
    }
    byPattern[issue.pattern].count += issue.count;
    byPattern[issue.pattern].files.push(`${issue.file} (${issue.count})`);
  }
  
  console.log('ISSUES BY PATTERN:');
  console.log('-'.repeat(60));
  
  for (const [pattern, data] of Object.entries(byPattern)) {
    console.log(`\n📌 ${pattern}: ${data.count} occurrences`);
    console.log(`   Fix: ${data.fix}`);
    console.log(`   Files:`);
    for (const file of data.files.slice(0, 10)) {
      console.log(`     - ${file}`);
    }
    if (data.files.length > 10) {
      console.log(`     ... and ${data.files.length - 10} more files`);
    }
  }
  
  // Priority list
  console.log('\n');
  console.log('=' .repeat(60));
  console.log('PRIORITY REFACTOR LIST (by issue count):');
  console.log('=' .repeat(60));
  
  const fileIssueCount = {};
  for (const issue of allIssues) {
    fileIssueCount[issue.file] = (fileIssueCount[issue.file] || 0) + issue.count;
  }
  
  const sorted = Object.entries(fileIssueCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  
  for (const [file, count] of sorted) {
    console.log(`  ${count.toString().padStart(3)} issues: ${file}`);
  }
  
  // Exit with error if there are critical issues
  if (bySevertiy.error.length > 0) {
    process.exit(1);
  }
}

main();
