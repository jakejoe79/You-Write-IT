const express = require('express');
const router = express.Router();
const { getGenre } = require('../config/genreProfiles');
const { getStyleGuidelines } = require('../config/styleMapper');
const { getVariation } = require('../services/agents/styleVariance');
const { buildConstraintBlock } = require('../utils/constraints');
const { updateEmotion, describeEmotion, emptyEmotionState, applyGenreBias } = require('../utils/emotionState');
const { ContextWindow } = require('../services/core/memoryCompressor');
const { getVoiceBlock } = require('../characters/voiceProfiles');
const { generateAndValidate } = require('../services/agents/sceneValidator');
const { checkContinuity } = require('../services/agents/continuity');
const { createSession, addScene, updateSessionState } = require('../db/sqlite');
const { LLMChain } = require('langchain/chains');
const { PromptTemplate } = require('@langchain/core/prompts');
const { llm } = require('../services/core/llm');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const writerPrompt = fs.readFileSync(
  path.resolve(__dirname, '../../prompts/writer.txt'), 'utf8'
);

const sceneChain = new LLMChain({
  llm,
  prompt: PromptTemplate.fromTemplate(`
${writerPrompt}
{genreRules}
{styleGuidelines}
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

function send(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// POST /api/stream/story — streams scenes as SSE with session persistence
router.post('/story', async (req, res) => {
  const {
    input, scenes = 3, genre = null, authorStyle = null,
    protagonist = null, sessionId = null,
  } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  try {
    // Create or reuse session
    const id = sessionId || await createSession({
      mode: 'story', title: input?.slice(0, 50), genre, authorStyle, protagonist,
      state: { characters: {}, inventory: [], choices_made: [], world_rules: [] },
    });

    const genreProfile    = getGenre(genre);
    const genreRules      = genre ? require('../config/genreProfiles').getGenreConstraints(genre) : '';
    const styleGuidelines = authorStyle ? getStyleGuidelines(authorStyle) : '';
    const constraints     = buildConstraintBlock(genre ? genreProfile.hardConstraints : []);
    const voice           = getVoiceBlock(protagonist);
    const memory          = new ContextWindow({ rawWindow: 3 });
    let emotionState      = applyGenreBias(emptyEmotionState(), genreProfile.emotionBias || {});
    const rawScenes       = [];

    send(res, 'start', { sessionId: id, total: scenes });

    for (let i = 1; i <= scenes; i++) {
      const variation = getVariation(i - 1);
      emotionState = updateEmotion(emotionState, variation.label);
      const emotion = describeEmotion(emotionState);
      const context = memory.render();

      send(res, 'progress', { scene: i, total: scenes, status: 'generating' });

      const callArgs = {
        sceneNum: i, totalScenes: scenes, context, input,
        constraints, voice, genreRules, styleGuidelines,
        variation: variation.instruction, emotion,
      };

      const { text, validation } = await generateAndValidate(sceneChain, callArgs, variation.label);
      rawScenes.push(text);
      await memory.add(text);

      // Persist scene
      await addScene(id, i, text, emotionState, validation);
      send(res, 'scene', { index: i, text, validation, emotion: emotionState });
    }

    send(res, 'progress', { status: 'checking continuity' });
    const { corrected, report } = await checkContinuity(rawScenes);

    // Update session state with final emotion
    await updateSessionState(id, { protagonist: emotionState.protagonist });

    send(res, 'done', { sessionId: id, scenes: corrected, continuityReport: report });
  } catch (err) {
    send(res, 'error', { message: err.message });
  } finally {
    res.end();
  }
});

// GET /api/session/:id — retrieve session and scenes
router.get('/session/:id', async (req, res) => {
  try {
    const session = await require('../db/sqlite').getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const scenes = await require('../db/sqlite').getScenes(req.params.id);
    res.json({ session, scenes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/session/:id/scene/:index — update scene content (user edits)
router.post('/session/:id/scene/:index', async (req, res) => {
  try {
    const { id, index } = req.params;
    const { content } = req.body;
    await require('../db/sqlite').updateSceneContent(id, parseInt(index), content);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
