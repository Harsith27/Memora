const mongoose = require('mongoose');

const docTagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Document/folder name is required'],
    trim: true,
    maxlength: [200, 'Name cannot exceed 200 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
    default: ''
  },
  type: {
    type: String,
    enum: ['folder', 'document'],
    required: [true, 'Type is required']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DocTag',
    default: null // null means root level
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  category: {
    type: String,
    enum: ['Science', 'Mathematics', 'History', 'Language', 'Technology', 'Arts', 'Business', 'Personal', 'Research', 'Other'],
    default: 'Other'
  },
  // File attachments for documents
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    fileType: {
      type: String,
      enum: ['pdf', 'image', 'video', 'audio', 'document', 'other'],
      default: 'other'
    }
  }],
  // External links (YouTube, Google Drive, etc.)
  externalLinks: [{
    title: {
      type: String,
      required: true,
      maxlength: [200, 'Link title cannot exceed 200 characters']
    },
    url: {
      type: String,
      required: true,
      maxlength: [2000, 'URL cannot exceed 2000 characters']
    },
    type: {
      type: String,
      enum: ['youtube', 'google_drive', 'notion', 'github', 'website', 'file', 'other'],
      default: 'other'
    },
    description: {
      type: String,
      maxlength: [500, 'Link description cannot exceed 500 characters'],
      default: ''
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Folder-specific properties
  color: {
    type: String,
    enum: ['blue', 'green', 'purple', 'red', 'orange', 'yellow', 'pink', 'gray'],
    default: 'blue'
  },
  icon: {
    type: String,
    enum: ['folder', 'book', 'code', 'science', 'math', 'art', 'music', 'video', 'image', 'document'],
    default: 'folder'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  // Access and sharing
  isPublic: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permission: {
      type: String,
      enum: ['view', 'edit'],
      default: 'view'
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Metadata
  lastAccessed: {
    type: Date,
    default: Date.now
  },
  accessCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for better query performance
docTagSchema.index({ userId: 1, type: 1, createdAt: -1 });
docTagSchema.index({ userId: 1, parentId: 1 });
docTagSchema.index({ userId: 1, category: 1 });
docTagSchema.index({ userId: 1, isFavorite: 1 });
docTagSchema.index({ tags: 1 });
docTagSchema.index({ name: 'text', description: 'text' });

// Virtual for getting full path
docTagSchema.virtual('fullPath').get(function() {
  // This would need to be populated with parent data
  return this.name;
});

// Instance method to get all children (recursive)
docTagSchema.methods.getAllChildren = async function() {
  const children = await this.constructor.find({ parentId: this._id, isActive: true });
  let allChildren = [...children];
  
  for (const child of children) {
    const grandChildren = await child.getAllChildren();
    allChildren = allChildren.concat(grandChildren);
  }
  
  return allChildren;
};

// Instance method to get folder size (total attachments size)
docTagSchema.methods.getFolderSize = async function() {
  if (this.type === 'document') {
    return this.attachments.reduce((total, attachment) => total + attachment.size, 0);
  }
  
  const children = await this.getAllChildren();
  let totalSize = 0;
  
  for (const child of children) {
    if (child.type === 'document') {
      totalSize += child.attachments.reduce((total, attachment) => total + attachment.size, 0);
    }
  }
  
  return totalSize;
};

// Static method to get folder structure
docTagSchema.statics.getFolderStructure = function(userId, parentId = null) {
  return this.find({
    userId,
    parentId,
    isActive: true
  }).sort({ type: -1, name: 1 }); // Folders first, then documents, alphabetically
};

// Static method to search across all documents and folders
docTagSchema.statics.searchDocTags = function(userId, query, options = {}) {
  const searchQuery = {
    userId,
    isActive: true,
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } },
      { 'attachments.originalName': { $regex: query, $options: 'i' } },
      { 'externalLinks.title': { $regex: query, $options: 'i' } }
    ]
  };
  
  if (options.type) {
    searchQuery.type = options.type;
  }
  
  if (options.category) {
    searchQuery.category = options.category;
  }
  
  return this.find(searchQuery)
    .sort({ lastAccessed: -1, createdAt: -1 })
    .limit(options.limit || 50);
};

// Static method to get recent documents
docTagSchema.statics.getRecentDocuments = function(userId, limit = 10) {
  return this.find({
    userId,
    type: 'document',
    isActive: true
  })
  .sort({ lastAccessed: -1 })
  .limit(limit);
};

// Static method to get favorites
docTagSchema.statics.getFavorites = function(userId) {
  return this.find({
    userId,
    isFavorite: true,
    isActive: true
  }).sort({ name: 1 });
};

const DocTag = mongoose.model('DocTag', docTagSchema);

module.exports = DocTag;
