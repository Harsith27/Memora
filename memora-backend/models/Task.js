const mongoose = require('mongoose');

const TASK_TYPES = ['one-time', 'recurring', 'custom-recurring'];

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  clientId: {
    type: String,
    required: [true, 'Client task ID is required'],
    trim: true
  },
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [140, 'Task title cannot exceed 140 characters']
  },
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: [600, 'Task description cannot exceed 600 characters']
  },
  date: {
    type: String,
    required: [true, 'Task date is required'],
    match: [/^\d{4}-\d{2}-\d{2}$/, 'Task date must be in YYYY-MM-DD format'],
    index: true
  },
  taskType: {
    type: String,
    enum: TASK_TYPES,
    default: 'one-time'
  },
  seriesId: {
    type: String,
    default: null,
    trim: true
  },
   completed: {
    type: Boolean,
    default: false,
    index: true
  },
  completionType: {
    type: String,
    enum: ['boolean', 'quantity', 'percent', 'time'],
    default: 'boolean'
  },
  targetValue: {
    type: Number,
    default: 1
  },
  currentValue: {
    type: Number,
    default: 0
  },
  partiallyCompleted: {
    type: Boolean,
    default: false,
    index: true
  },
  startTime: {
    type: String,
    default: null,
    trim: true
  },
  duration: {
    type: Number,
    default: 30
  },
  createdAtMs: {
    type: Number,
    required: true,
    default: () => Date.now()
  },
  updatedAtMs: {
    type: Number,
    required: true,
    default: () => Date.now()
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function transform(doc, ret) {
      ret.id = ret.clientId;
      delete ret._id;
      delete ret.__v;
      delete ret.clientId;
      return ret;
    }
  }
});

taskSchema.index({ userId: 1, clientId: 1 }, { unique: true });
taskSchema.index({ userId: 1, date: 1, completed: 1 });

module.exports = mongoose.model('Task', taskSchema);
