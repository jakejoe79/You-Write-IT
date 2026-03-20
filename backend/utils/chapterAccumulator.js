/**
 * ChapterAccumulator - Buffers LLM chunks until chapter target length is reached
 * 
 * Usage:
 * const accumulator = new ChapterAccumulator({ minWords: 3000, maxWords: 5000 });
 * for await (const chunk of pipelineStream) {
 *   const chapter = accumulator.addChunk(chunk.text);
 *   if (chapter) {
 *     // Emit chapter via SSE
 *   }
 * }
 * const finalChapter = accumulator.forceFlush(); // Flush remaining
 */

class ChapterAccumulator {
  constructor({ minWords = 3000, maxWords = 5000 } = {}) {
    this.minWords = minWords;
    this.maxWords = maxWords;
    this.buffer = '';
    this.wordCount = 0;
    this.chapterIndex = 0;
    this.isComplete = false;
  }

  /**
   * Add a chunk of text to the accumulator
   * Returns a chapter if target is reached, null otherwise
   */
  addChunk(text) {
    if (this.isComplete || !text) return null;

    this.buffer += (this.buffer ? ' ' : '') + text;
    this.wordCount += this.countWords(text);

    // Check if we've reached minimum and hit a sentence boundary
    if (this.wordCount >= this.minWords) {
      const chapter = this.flush(false);
      if (chapter) return chapter;
    }

    // If we're way over max, force flush at sentence boundary
    if (this.wordCount >= this.maxWords) {
      return this.flush(false);
    }

    return null;
  }

  /**
   * Force flush the current buffer as a chapter
   * Call this when generation is complete or at natural breaks
   */
  forceFlush() {
    if (this.wordCount === 0) return null;
    return this.flush(true);
  }

  /**
   * Internal flush - extracts complete sentences and creates chapter
   */
  flush(isFinal = false) {
    if (this.wordCount === 0) return null;

    // Trim to last complete sentence
    const content = this.trimToSentence(this.buffer);
    const actualWordCount = this.countWords(content);

    const chapter = {
      index: this.chapterIndex,
      content,
      wordCount: actualWordCount,
      status: isFinal ? 'complete' : 'complete',
      isFinal,
    };

    // Reset for next chapter
    this.buffer = '';
    this.wordCount = 0;
    this.chapterIndex++;

    return chapter;
  }

  /**
   * Trim buffer to last complete sentence (ends with . ! or ?)
   */
  trimToSentence(text) {
    if (!text) return text;
    
    // Find the last sentence-ending punctuation
    const match = text.match(/([^.!?]*[.!?]+)\s*$/);
    
    if (match) {
      return match[1].trim();
    }
    
    // If no complete sentence, return what we have
    return text.trim();
  }

  /**
   * Count words in text
   */
  countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  /**
   * Get current buffer state (for debugging/resume)
   */
  getState() {
    return {
      bufferLength: this.buffer.length,
      wordCount: this.wordCount,
      chapterIndex: this.chapterIndex,
      isComplete: this.isComplete,
    };
  }

  /**
   * Mark accumulator as complete (no more chunks coming)
   */
  complete() {
    this.isComplete = true;
  }
}

module.exports = ChapterAccumulator;