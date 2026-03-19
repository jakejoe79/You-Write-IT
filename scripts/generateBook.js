#!/usr/bin/env node
// Production run — generates a complete short novel + 2 abridged versions, exports all to EPUB.
// Usage: node scripts/generateBook.js
// Output: data/outputs/*.epub  +  data/outputs/run-<timestamp>.json (full text log)

const fs   = require('fs');
const path = require('path');
const pipeline = require('../backend/services/core/pipeline');
const epub     = require('../backend/services/export/epub');

const OUT_DIR = path.resolve(__dirname, '../data/outputs');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const TIMESTAMP = Date.now();

// ─── Story premise ────────────────────────────────────────────────────────────
const PREMISE = `
A detective named Harlan Cross discovers that reality resets every time he lies.
He works in a city where it rains upward and clocks run backwards after midnight.
His partner has just been murdered — and the only witness is a woman who claims
she has already watched Harlan solve this case three times before.
`.trim();

// ─── Helpers ─────────────────────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function extractText(result) {
  if (typeof result === 'string') return result;
  if (result?.scenes)  return result.scenes.join('\n\n\n');
  if (result?.text)    return result.text;
  return JSON.stringify(result);
}

async function exportAndLog(label, content, metadata) {
  log(`Exporting: ${label}`);
  try {
    const result = await epub.export(content, metadata);
    log(`  → ${result.path} (${result.chapters} chapters)`);
    return result.path;
  } catch (err) {
    log(`  ✗ Export failed: ${err.message}`);
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const run = { timestamp: TIMESTAMP, outputs: [] };

  // 1. Full novel — thriller, king_like style, 10 scenes
  log('Generating full novel (10 scenes, thriller, king_like)...');
  const novelResult = await pipeline.run('story', PREMISE, {
    scenes:      10,
    genre:       'thriller',
    authorStyle: 'king_like',
    protagonist: 'protagonist',
  });
  const novelText = extractText(novelResult);
  log(`  → ${novelText.split(/\s+/).length} words generated`);

  if (novelResult.continuityReport?.length) {
    const issues = novelResult.continuityReport.filter(r => !/no issues/i.test(r.issues));
    if (issues.length) {
      log(`  ⚠ Continuity issues found in ${issues.length} scene(s):`);
      issues.forEach(r => log(`    Scene ${r.scene}: ${r.issues.slice(0, 120)}...`));
    } else {
      log('  ✓ Continuity clean');
    }
  }

  run.outputs.push({ label: 'novel', wordCount: novelText.split(/\s+/).length });
  await exportAndLog('Full novel', novelText, {
    title: 'The Reset Detective',
    author: 'ai-book-factory',
  });

  // 2. Abridged — middle_school
  log('\nGenerating abridged version (middle_school)...');
  const msResult = await pipeline.run('abridged', novelText, {
    chunkSize:     1500,
    reading_level: 'middle_school',
    chapterHooks:  true,
  });
  const msText = extractText(msResult);
  log(`  → ${msText.split(/\s+/).length} words`);
  run.outputs.push({ label: 'abridged_middle_school', wordCount: msText.split(/\s+/).length });
  await exportAndLog('Abridged (middle_school)', msText, {
    title: 'The Reset Detective — Abridged Edition',
    author: 'ai-book-factory',
  });

  // 3. Abridged — ESL
  log('\nGenerating abridged version (ESL)...');
  const eslResult = await pipeline.run('abridged', novelText, {
    chunkSize:     1500,
    reading_level: 'esl',
    chapterHooks:  true,
  });
  const eslText = extractText(eslResult);
  log(`  → ${eslText.split(/\s+/).length} words`);
  run.outputs.push({ label: 'abridged_esl', wordCount: eslText.split(/\s+/).length });
  await exportAndLog('Abridged (ESL)', eslText, {
    title: 'The Reset Detective — ESL Edition',
    author: 'ai-book-factory',
  });

  // Save full text log for human review
  const logPath = path.join(OUT_DIR, `run-${TIMESTAMP}.json`);
  fs.writeFileSync(logPath, JSON.stringify({
    ...run,
    novel:            novelText,
    abridged_ms:      msText,
    abridged_esl:     eslText,
    continuityReport: novelResult.continuityReport || [],
  }, null, 2));

  log(`\nRun log saved: ${logPath}`);
  log('\nDone. Open the EPUBs in Calibre and read them like a human.');
  log('Check: engagement, flow, emotional payoff, chapter pacing.');
})().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
