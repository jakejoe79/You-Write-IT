// Genre profiles — genre is a HARD constraint system.
// It defines plot logic, pacing rules, and stakes boundaries.
// These merge into HARD constraints in the prompt — the model cannot ignore them.

const genres = {
  thriller: {
    pacing: 'fast — scenes should move quickly, no lingering',
    tension: 'high — something must always feel at risk',
    stakes: 'constant escalation — each scene raises the cost of failure',
    emotionBias: { fear: +0.3, hope: -0.1 },
    hardConstraints: [
      'maintain suspense — never fully resolve tension within a scene',
      'avoid long exposition — reveal information through action and dialogue',
      'conflict must escalate — do not let stakes plateau',
      'the protagonist must never feel fully safe',
    ],
  },
  horror: {
    pacing: 'variable — slow dread punctuated by sudden violence',
    tension: 'atmospheric — unease should precede every threat',
    stakes: 'survival and sanity',
    emotionBias: { fear: +0.4, hope: -0.2, despair: +0.1 },
    hardConstraints: [
      'maintain dread — the unknown is more frightening than the revealed',
      'consequences must feel permanent and visceral',
      'the protagonist should be reactive, not in control',
      'never explain the horror fully',
    ],
  },
  fantasy: {
    pacing: 'moderate — allow space for worldbuilding',
    tension: 'moderate — conflict driven by stakes within the world rules',
    stakes: 'world-level or personal destiny',
    emotionBias: { hope: +0.1, resolve: +0.1 },
    hardConstraints: [
      'respect established world rules — magic has limits',
      'introduce lore gradually — do not info-dump',
      'character agency must feel meaningful within the world',
    ],
  },
  romance: {
    pacing: 'slow to moderate — emotional beats matter more than plot beats',
    tension: 'interpersonal — conflict comes from connection and resistance',
    stakes: 'emotional vulnerability and relationship',
    emotionBias: { hope: +0.3, fear: +0.1, joy: +0.1 },
    hardConstraints: [
      'emotional authenticity is non-negotiable',
      'avoid resolving romantic tension too early',
      'character interiority must be rich — show longing, not just action',
    ],
  },
  mystery: {
    pacing: 'deliberate — clues must be planted before they are revealed',
    tension: 'intellectual — the reader should be able to solve it',
    stakes: 'truth and justice',
    emotionBias: { resolve: +0.2, fear: +0.1 },
    hardConstraints: [
      'every clue introduced must be fair — no hidden information',
      'the solution must follow logically from what was established',
      'red herrings are allowed but must be resolvable in retrospect',
      'the detective must earn the solution through observation',
    ],
  },
  literary: {
    pacing: 'slow — prose quality and interiority take precedence',
    tension: 'internal — conflict lives in the character, not the plot',
    stakes: 'meaning, identity, human connection',
    emotionBias: { grief: +0.1, resolve: +0.1 },
    hardConstraints: [
      'prioritize psychological depth over plot mechanics',
      'ambiguity is acceptable — not everything needs resolution',
      'language should be precise and intentional',
    ],
  },
};

/**
 * Returns the genre profile for a given genre key.
 * Falls back to literary if not found.
 */
function getGenre(genreKey) {
  return genres[genreKey?.toLowerCase()] || genres.literary;
}

/**
 * Returns a prompt-ready block of genre rules (hard constraints only).
 */
function getGenreConstraints(genreKey) {
  const genre = getGenre(genreKey);
  return [
    `Genre rules (treat as hard constraints):`,
    `- Pacing: ${genre.pacing}`,
    `- Tension: ${genre.tension}`,
    `- Stakes: ${genre.stakes}`,
    ...genre.hardConstraints.map(c => `- ${c}`),
  ].join('\n');
}

module.exports = { genres, getGenre, getGenreConstraints };
