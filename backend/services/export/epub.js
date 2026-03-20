// Delegates to Python epub builder via child_process
// Runs chapter balancing before export so Kindle readers get consistent chapter lengths
const { execFile } = require('child_process');
const path = require('path');
const { balance, report } = require('../../utils/chapterBalancer');
const logger = require('../../utils/logger');
const crypto = require('crypto');

async function exportEpub(content, metadata = {}) {
  const { title = 'Untitled', author = 'Unknown', balanceChapters = true } = metadata;

  let chapters = Array.isArray(content) ? content : content.split(/\n{3,}/);

  if (balanceChapters) {
    chapters = balance(chapters);
    const chapterReport = report(chapters);
    logger.info('Chapter balance report:', chapterReport);
  }

  const finalContent = chapters.join('\n\n\n');
  // Unique filename to prevent race conditions
  const timestamp = Date.now();
  const shortId = crypto.randomBytes(4).toString('hex');
  const safeTitle = (title || 'untitled').replace(/[^a-z0-9]/gi, '_').slice(0, 30);
  const outPath = path.resolve(__dirname, `../../../../data/outputs/${safeTitle}_${timestamp}_${shortId}.epub`);

  return new Promise((resolve, reject) => {
    const script = path.resolve(__dirname, '../../../../python/epub_builder.py');
    execFile('python', [script, '--title', title, '--author', author, '--output', outPath], {
      input: finalContent,
    }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve({ path: outPath, filename: path.basename(outPath), message: stdout.trim(), chapters: chapters.length });
    });
  });
}

module.exports = { export: exportEpub };
