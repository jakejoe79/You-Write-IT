// Style mapper — author style as SOFT behavioral instructions, not names.
// Never inject "write like X" — translate into concrete behaviors instead.
// This avoids imitation, inconsistency, and legal gray areas.

const styles = {
  king_like: {
    tone: 'dark, immersive, grounded in the mundane before turning strange',
    strengths: ['psychological depth', 'slow tension build', 'ordinary characters in extraordinary situations'],
    quirks: ['vivid sensory descriptions', 'heavy internal monologue', 'colloquial narrative voice', 'pop culture references as anchors'],
    sentenceStyle: 'varied length — short punches mixed with long flowing passages',
  },
  hemingway_like: {
    tone: 'minimalist, restrained, emotionally loaded through omission',
    strengths: ['subtext over statement', 'dialogue that carries weight', 'economy of language'],
    quirks: ['understatement', 'iceberg principle — most meaning is below the surface', 'no adverbs'],
    sentenceStyle: 'short, declarative, active voice',
  },
  dickens_like: {
    tone: 'vivid, morally charged, socially aware',
    strengths: ['rich character sketches', 'satirical observation', 'emotional melodrama used deliberately'],
    quirks: ['memorable character names that hint at personality', 'detailed social settings', 'coincidence as plot device'],
    sentenceStyle: 'long, layered sentences with embedded clauses',
  },
  carver_like: {
    tone: 'quiet, working-class, emotionally devastating through restraint',
    strengths: ['domestic tension', 'what is NOT said', 'endings that refuse resolution'],
    quirks: ['flat affect that hides deep feeling', 'alcohol and economic anxiety as backdrop', 'dialogue as evasion'],
    sentenceStyle: 'plain, direct, almost affectless',
  },
  le_guin_like: {
    tone: 'thoughtful, anthropological, morally complex',
    strengths: ['worldbuilding through implication', 'gender and power as themes', 'slow philosophical depth'],
    quirks: ['invented social structures feel lived-in', 'prose that earns its beauty', 'characters shaped by their world'],
    sentenceStyle: 'clear and precise with occasional lyrical passages',
  },
  custom: {
    tone: 'neutral',
    strengths: [],
    quirks: [],
    sentenceStyle: 'varied',
  },
};

/**
 * Returns the style profile for a given key.
 * Falls back to custom (neutral) if not found.
 */
function getStyle(styleKey) {
  return styles[styleKey?.toLowerCase()] || styles.custom;
}

/**
 * Returns a prompt-ready soft style block — behaviors, not names.
 */
function getStyleGuidelines(styleKey) {
  const style = getStyle(styleKey);
  const lines = [
    `Style guidelines (soft — prefer these, adapt as needed):`,
    `- Tone: ${style.tone}`,
    `- Sentence style: ${style.sentenceStyle}`,
  ];
  if (style.strengths.length) lines.push(`- Emphasize: ${style.strengths.join(', ')}`);
  if (style.quirks.length)    lines.push(`- Quirks to use: ${style.quirks.join(', ')}`);
  return lines.join('\n');
}

module.exports = { styles, getStyle, getStyleGuidelines };
