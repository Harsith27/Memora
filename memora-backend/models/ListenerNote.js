const mongoose = require('mongoose');

const listenerNoteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    default: null,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [160, 'Title cannot exceed 160 characters']
  },
  transcript: {
    type: String,
    required: [true, 'Transcript is required'],
    maxlength: [50000, 'Transcript cannot exceed 50000 characters']
  },
  summary: {
    type: String,
    required: [true, 'Summary is required'],
    maxlength: [50000, 'Summary cannot exceed 50000 characters']
  },
  language: {
    type: String,
    default: 'en',
    trim: true,
    maxlength: [20, 'Language code cannot exceed 20 characters']
  },
  durationSeconds: {
    type: Number,
    default: 0,
    min: [0, 'Duration cannot be negative']
  },
  visualizerStyle: {
    type: String,
    default: 'pulse',
    trim: true,
    maxlength: [40, 'Visualizer style cannot exceed 40 characters']
  },
  wordCount: {
    type: Number,
    default: 0,
    min: [0, 'Word count cannot be negative']
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function transformDoc(_, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

listenerNoteSchema.index({ userId: 1, createdAt: -1 });
listenerNoteSchema.index({ userId: 1, topicId: 1, createdAt: -1 });

module.exports = mongoose.model('ListenerNote', listenerNoteSchema);
