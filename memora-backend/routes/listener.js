const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const { Blob: NodeBlob } = require('buffer');

const { authenticateToken } = require('../middleware/auth');
const Topic = require('../models/Topic');
const ListenerNote = require('../models/ListenerNote');

const router = express.Router();

const TEMP_AUDIO_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_AUDIO_FILE_SIZE = 25 * 1024 * 1024;
const TEMP_AUDIO_DIR = path.join(__dirname, '..', 'uploads', 'listener-audio');

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac'
]);

const ensureTempAudioDirectory = async () => {
  await fs.promises.mkdir(TEMP_AUDIO_DIR, { recursive: true });
};

const cleanupTempAudioFiles = async () => {
  await ensureTempAudioDirectory();

  const entries = await fs.promises.readdir(TEMP_AUDIO_DIR, { withFileTypes: true });
  const now = Date.now();

  await Promise.all(entries.map(async (entry) => {
    if (!entry.isFile()) return;

    const fullPath = path.join(TEMP_AUDIO_DIR, entry.name);

    try {
      const stats = await fs.promises.stat(fullPath);
      const ageMs = now - Number(stats.mtimeMs || 0);

      if (ageMs >= TEMP_AUDIO_RETENTION_MS) {
        await fs.promises.unlink(fullPath);
      }
    } catch (error) {
      // Ignore stale file cleanup failures and continue.
      console.warn('Listener cleanup warning:', error?.message || error);
    }
  }));
};

const sanitizeFilename = (value = 'listener-recording') => {
  return String(value)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
};

const normalizeGroqApiKey = (value) => {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\s+/g, '')
    .trim();
};

const storage = multer.diskStorage({
  destination: async (_req, _file, callback) => {
    try {
      await ensureTempAudioDirectory();
      callback(null, TEMP_AUDIO_DIR);
    } catch (error) {
      callback(error, TEMP_AUDIO_DIR);
    }
  },
  filename: (req, file, callback) => {
    const userId = String(req.user?.id || 'user').slice(0, 24);
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 10);
    const original = sanitizeFilename(file.originalname || 'listener-recording.webm');
    const ext = path.extname(original) || '.webm';
    const base = path.basename(original, ext) || 'listener-recording';
    callback(null, `${userId}_${timestamp}_${random}_${base}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_AUDIO_FILE_SIZE
  },
  fileFilter: (_req, file, callback) => {
    const mimeType = String(file.mimetype || '').toLowerCase();
    if (ALLOWED_AUDIO_MIME_TYPES.has(mimeType) || mimeType.startsWith('audio/')) {
      callback(null, true);
      return;
    }

    callback(new Error('Unsupported audio format'), false);
  }
});

const callGroqTranscription = async ({ filePath, mimeType, fileName, language }) => {
  const apiKey = normalizeGroqApiKey(process.env.GROQ_API_KEY);
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is missing in backend environment variables');
  }

  const transcriptModel = process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3-turbo';
  const fileBuffer = await fs.promises.readFile(filePath);
  const BlobClass = typeof Blob !== 'undefined' ? Blob : NodeBlob;
  const FormDataClass = typeof FormData !== 'undefined' ? FormData : null;

  if (!BlobClass || !FormDataClass) {
    throw new Error('Current Node.js runtime does not support fetch FormData/Blob required for transcription');
  }

  const fileBlob = new BlobClass([fileBuffer], { type: mimeType || 'audio/webm' });

  const body = new FormDataClass();
  body.append('model', transcriptModel);
  body.append('language', language || 'en');
  body.append('response_format', 'json');
  body.append('file', fileBlob, fileName || 'listener-recording.webm');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq transcription failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const transcript = String(data?.text || '').trim();

  if (!transcript) {
    throw new Error('Transcription returned empty text');
  }

  return transcript;
};

const callGroqSummarization = async (transcript) => {
  const apiKey = normalizeGroqApiKey(process.env.GROQ_API_KEY);
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is missing in backend environment variables');
  }

  const summaryModel = process.env.GROQ_MODEL || process.env.GROQ_SUMMARY_MODEL || 'llama-3.3-70b-versatile';

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: summaryModel,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        {
          role: 'system',
          content: 'You are rewriting class audio into natural student notes. The final text must feel like something a real student wrote in their own notebook, not AI output. Keep the same meaning, improve grammar, remove filler words, and keep the idea flow logical. You may add short clarifying lines only when directly supported by the transcript. Do not invent facts. Output format: one short title line, then 2 to 4 natural paragraphs in plain language. No section headings, no bullet points, no labels, no robotic phrases.'
        },
        {
          role: 'user',
          content: `Rewrite this spoken transcript as clean, human-sounding study notes that read like personal notebook paragraphs:\n\n${transcript}`
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq summarization failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const summary = String(data?.choices?.[0]?.message?.content || '').trim();

  if (!summary) {
    throw new Error('Summarization returned empty text');
  }

  return summary;
};

const buildNoteTitle = (summary, fallback = 'Listener Revision Note') => {
  const firstMeaningfulLine = String(summary || '')
    .split('\n')
    .map((line) => line.replace(/^[-#*\d.\s]+/, '').trim())
    .find(Boolean);

  if (!firstMeaningfulLine) return fallback;

  return firstMeaningfulLine.slice(0, 80);
};

const toNoteResponse = (noteDoc) => ({
  id: String(noteDoc._id),
  title: noteDoc.title,
  transcript: noteDoc.transcript,
  summary: noteDoc.summary,
  language: noteDoc.language,
  durationSeconds: noteDoc.durationSeconds,
  visualizerStyle: noteDoc.visualizerStyle,
  wordCount: noteDoc.wordCount,
  topic: noteDoc.topicId
    ? {
      id: String(noteDoc.topicId._id || noteDoc.topicId),
      title: noteDoc.topicId.title || ''
    }
    : null,
  createdAt: noteDoc.createdAt,
  updatedAt: noteDoc.updatedAt
});

router.post('/process', authenticateToken, async (req, res) => {
  try {
    await cleanupTempAudioFiles();
  } catch (error) {
    console.warn('Listener pre-cleanup warning:', error?.message || error);
  }

  upload.single('audio')(req, res, async (uploadError) => {
    if (uploadError) {
      res.status(400).json({
        success: false,
        message: uploadError.message || 'Audio upload failed'
      });
      return;
    }

    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'Audio file is required'
        });
      }

      const userId = req.user.id;
      const language = String(req.body.language || 'en').trim().toLowerCase() || 'en';
      const durationSeconds = Math.max(0, Number(req.body.durationSeconds || 0));
      const visualizerStyle = String(req.body.visualizerStyle || 'pulse').trim().slice(0, 40) || 'pulse';
      const topicIdRaw = String(req.body.topicId || '').trim();

      let topic = null;
      if (topicIdRaw) {
        if (!mongoose.isValidObjectId(topicIdRaw)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid topic ID'
          });
        }

        topic = await Topic.findOne({
          _id: topicIdRaw,
          userId,
          isActive: true
        }).select('_id title');

        if (!topic) {
          return res.status(404).json({
            success: false,
            message: 'Linked topic not found'
          });
        }
      }

      const transcript = await callGroqTranscription({
        filePath: file.path,
        mimeType: file.mimetype,
        fileName: file.originalname,
        language
      });

      const summary = await callGroqSummarization(transcript);
      const title = buildNoteTitle(summary, topic ? `${topic.title} - Listener Note` : 'Listener Revision Note');
      const wordCount = transcript.split(/\s+/).filter(Boolean).length;

      const created = await ListenerNote.create({
        userId,
        topicId: topic ? topic._id : null,
        title,
        transcript,
        summary,
        language,
        durationSeconds,
        visualizerStyle,
        wordCount
      });

      const note = await ListenerNote.findById(created._id)
        .populate('topicId', 'title');

      return res.status(201).json({
        success: true,
        message: 'Listener note created successfully',
        note: toNoteResponse(note),
        storagePolicy: {
          audioRetentionHours: 24,
          storesVoicePermanently: false,
          storesNotesPermanently: true
        }
      });
    } catch (error) {
      console.error('Listener process error:', error);
      return res.status(500).json({
        success: false,
        message: error?.message || 'Failed to process listener recording'
      });
    } finally {
      try {
        await cleanupTempAudioFiles();
      } catch (cleanupError) {
        console.warn('Listener post-cleanup warning:', cleanupError?.message || cleanupError);
      }
    }
  });
});

router.get('/notes', authenticateToken, async (req, res) => {
  try {
    await cleanupTempAudioFiles();

    const userId = req.user.id;
    const topicIdRaw = String(req.query.topicId || '').trim();
    const limitRaw = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, 200)
      : 200;

    const query = { userId };

    if (topicIdRaw) {
      if (!mongoose.isValidObjectId(topicIdRaw)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid topic ID'
        });
      }
      query.topicId = topicIdRaw;
    }

    const notes = await ListenerNote.find(query)
      .populate('topicId', 'title')
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.json({
      success: true,
      notes: notes.map(toNoteResponse),
      count: notes.length
    });
  } catch (error) {
    console.error('List listener notes error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load listener notes'
    });
  }
});

router.put('/notes/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const noteId = req.params.id;

    if (!mongoose.isValidObjectId(noteId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid note ID'
      });
    }

    const nextTitle = String(req.body.title || '').trim();
    const topicIdRaw = req.body.topicId === null
      ? null
      : String(req.body.topicId || '').trim();

    let topicId = null;
    if (topicIdRaw) {
      if (!mongoose.isValidObjectId(topicIdRaw)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid topic ID'
        });
      }

      const topic = await Topic.findOne({ _id: topicIdRaw, userId, isActive: true }).select('_id');
      if (!topic) {
        return res.status(404).json({
          success: false,
          message: 'Linked topic not found'
        });
      }

      topicId = topic._id;
    }

    const update = {};

    if (req.body.title !== undefined) {
      update.title = nextTitle || 'Listener Revision Note';
    }

    if (req.body.topicId !== undefined) {
      update.topicId = topicId;
    }

    const updated = await ListenerNote.findOneAndUpdate(
      { _id: noteId, userId },
      { $set: update },
      { new: true }
    ).populate('topicId', 'title');

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Listener note not found'
      });
    }

    return res.json({
      success: true,
      message: 'Listener note updated',
      note: toNoteResponse(updated)
    });
  } catch (error) {
    console.error('Update listener note error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update listener note'
    });
  }
});

router.delete('/notes/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const noteId = req.params.id;

    if (!mongoose.isValidObjectId(noteId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid note ID'
      });
    }

    const removed = await ListenerNote.findOneAndDelete({
      _id: noteId,
      userId
    });

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: 'Listener note not found'
      });
    }

    return res.json({
      success: true,
      message: 'Listener note deleted'
    });
  } catch (error) {
    console.error('Delete listener note error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete listener note'
    });
  }
});

module.exports = router;
