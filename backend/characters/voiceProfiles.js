// Character voice profiles — enforces consistent voice across scenes.
// Without this, characters slowly drift into generic LLM-speak.
// Add a profile per named character. Inject into every writer prompt.

const voiceProfiles = {
  protagonist: {
    tone: 'introspective, sharp, slightly cynical',
    speech_pattern: 'short sentences, direct, rarely explains himself',
    quirks: ['asks rhetorical questions', 'uses dry humor', 'notices small details others miss'],
  },
  antagonist: {
    tone: 'controlled, precise, unsettlingly calm',
    speech_pattern: 'longer sentences, formal, never contracts words',
    quirks: ['speaks in absolutes', 'never raises voice', 'uses silence as a weapon'],
  },
  mentor: {
    tone: 'warm but evasive, speaks in implication',
    speech_pattern: 'indirect, uses metaphor and analogy',
    quirks: ['answers questions with questions', 'references the past obliquely'],
  },
};

/**
 * Returns a prompt-ready voice block for a named character.
 * Falls back to protagonist if name not found.
 */
function getVoiceBlock(characterName) {
  const key = characterName ? characterName.toLowerCase() : 'protagonist';
  const profile = voiceProfiles[key] || voiceProfiles.protagonist;

  return [
    `Character voice (${characterName || 'protagonist'}):`,
    `- Tone: ${profile.tone}`,
    `- Speech: ${profile.speech_pattern}`,
    `- Quirks: ${profile.quirks.join(', ')}`,
    `Maintain this voice consistently. Do not let it drift.`,
  ].join('\n');
}

/**
 * Returns a block covering all named characters in a scene.
 * Pass an array of character names that appear in the scene.
 */
function getVoiceBlockForCast(names = []) {
  if (!names.length) return getVoiceBlock(null);
  return names.map(n => getVoiceBlock(n)).join('\n\n');
}

/**
 * Register a custom voice profile at runtime (e.g. from user input).
 */
function registerVoice(name, profile) {
  voiceProfiles[name.toLowerCase()] = profile;
}

module.exports = { voiceProfiles, getVoiceBlock, getVoiceBlockForCast, registerVoice };
