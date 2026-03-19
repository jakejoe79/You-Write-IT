// Story mode — full pipeline: variation + emotion + memory + voice + scene validation
const { PromptTemplate } = require('@langchain/core/prompts');
const { LLMChain } = require('langchain/chains');
const { llm } = require('../core/llm');
const continuity = require('../agents/continuity');
const { getVariation } = require('../agents/styleVariance');
const { buildConstraintBlock } = require('../../utils/constraints');
const { updateEmotion, describeEmotion, emptyEmotionState } = require('../../utils/emotionState');
const { ContextWindow } = require('../core/memoryCompressor');
const { getVoiceBlock } = require('../../characters/voiceProfiles');
const { generateAndValidate } = require('../agents/sceneValidator');
const fs = require('fs');
const path = require('path');

const writerPrompt = fs.readFileSync(path.resolve(__dirname, '../../../prompts/writer.txt'), 'utf8');

const sceneChain = new LLMChain({
  llm,
  prompt: PromptTemplate.fromTemplate(`
${writerPrompt}

Style: {style}
Tone: {tone}
Scene number: {sceneNum} of {totalScenes}

{constraints}

{voice}

Scene direction: {variation}

Emotional state: {emotion}

Story context so far:
{context}

Write scene {sceneNum}:
{input}
  `.trim()),
});

async function run(input, options = {}) {
  const { style = 'literary', tone = 'neutral', scenes = 1, protagonist = null } = options;
  const constraints = buildConstraintBlock();
  const voice = getVoiceBlock(protagonist);

  if (scenes === 1) {
    const variation = getVariation(0);
    const emotion = describeEmotion(emptyEmotionState());
    const callArgs = {
      style, tone, sceneNum: 1, totalScenes: 1,
      context: 'None yet.', input, constraints, voice,
      variation: variation.instruction, emotion,
    };
    const { text } = await generateAndValidate(sceneChain, callArgs, variation.label);
    return text;
  }

  const rawScenes = [];
  const memory = new ContextWindow({ rawWindow: 3 });
  let emotionState = emptyEmotionState();

  for (let i = 1; i <= scenes; i++) {
    const variation = getVariation(i - 1);
    emotionState = updateEmotion(emotionState, variation.label);
    const emotion = describeEmotion(emotionState);
    const context = memory.render();

    const callArgs = {
      style, tone, sceneNum: i, totalScenes: scenes,
      context, input, constraints, voice,
      variation: variation.instruction, emotion,
    };

    const { text } = await generateAndValidate(sceneChain, callArgs, variation.label);
    rawScenes.push(text);
    await memory.add(text);
  }

  const { corrected, report } = await continuity.check(rawScenes);
  return { scenes: corrected, continuityReport: report };
}

module.exports = { run };
