const localDb = require('./localDb');
const Topic = require('../models/Topic');
const DocTag = require('../models/DocTag');
const RevisionHistory = require('../models/RevisionHistory');
const User = require('../models/User');
const mongoose = require('mongoose');

const syncWithCloud = async (userId) => {
  if (!userId || !mongoose.isValidObjectId(userId)) {
    return { success: false, message: 'Valid User ID is required' };
  }
  
  const stats = { pulled: 0, pushed: 0, errors: [] };

  try {
    // ----------------------------------------
    // 1. Sync User Document
    // ----------------------------------------
    const cloudUser = await User.findById(userId).lean();
    if (cloudUser) {
      localDb.saveItem('users', cloudUser);
      stats.pulled++;
    }

    // ----------------------------------------
    // 2. Sync DocTags
    // ----------------------------------------
    const cloudTags = await DocTag.find({ userId }).lean();
    const localTags = localDb.readCollection('doctags').filter(t => String(t.userId) === String(userId));

    // Pull from cloud to local
    for (const cloudTag of cloudTags) {
      const localTag = localTags.find(t => String(t._id) === String(cloudTag._id));
      if (!localTag || new Date(cloudTag.updatedAt) > new Date(localTag.updatedAt || 0)) {
        localDb.saveItem('doctags', cloudTag);
        stats.pulled++;
      }
    }

    // Push from local to cloud
    for (const localTag of localTags) {
      const cloudTag = cloudTags.find(t => String(t._id) === String(localTag._id));
      if (!cloudTag) {
        try {
          const newTag = new DocTag(localTag);
          await newTag.save();
          stats.pushed++;
        } catch (e) {
          stats.errors.push(`DocTag push failed: ${e.message}`);
        }
      } else if (new Date(localTag.updatedAt || 0) > new Date(cloudTag.updatedAt)) {
        try {
          await DocTag.findByIdAndUpdate(localTag._id, localTag);
          stats.pushed++;
        } catch (e) {
          stats.errors.push(`DocTag update failed: ${e.message}`);
        }
      }
    }

    // ----------------------------------------
    // 3. Sync Topics
    // ----------------------------------------
    const cloudTopics = await Topic.find({ userId }).lean();
    const localTopics = localDb.readCollection('topics').filter(t => String(t.userId) === String(userId));

    // Pull from cloud to local
    for (const cloudTopic of cloudTopics) {
      const localTopic = localTopics.find(t => String(t._id) === String(cloudTopic._id));
      if (!localTopic || new Date(cloudTopic.updatedAt) > new Date(localTopic.updatedAt || 0)) {
        localDb.saveItem('topics', cloudTopic);
        stats.pulled++;
      }
    }

    // Push from local to cloud
    for (const localTopic of localTopics) {
      const cloudTopic = cloudTopics.find(t => String(t._id) === String(localTopic._id));
      if (!cloudTopic) {
        try {
          const newTopic = new Topic(localTopic);
          await newTopic.save();
          stats.pushed++;
        } catch (e) {
          stats.errors.push(`Topic push failed: ${e.message}`);
        }
      } else if (new Date(localTopic.updatedAt || 0) > new Date(cloudTopic.updatedAt)) {
        try {
          await Topic.findByIdAndUpdate(localTopic._id, localTopic);
          stats.pushed++;
        } catch (e) {
          stats.errors.push(`Topic update failed: ${e.message}`);
        }
      }
    }

    // ----------------------------------------
    // 4. Sync RevisionHistory
    // ----------------------------------------
    const cloudHistories = await RevisionHistory.find({ userId }).lean();
    const localHistories = localDb.readCollection('revisionhistories').filter(h => String(h.userId) === String(userId));

    // Pull from cloud to local
    for (const cloudHistory of cloudHistories) {
      const localHistory = localHistories.find(h => String(h._id) === String(cloudHistory._id));
      if (!localHistory) {
        localDb.saveItem('revisionhistories', cloudHistory);
        stats.pulled++;
      }
    }

    // Push from local to cloud
    for (const localHistory of localHistories) {
      const cloudHistory = cloudHistories.find(h => String(h._id) === String(localHistory._id));
      if (!cloudHistory) {
        try {
          const newHistory = new RevisionHistory(localHistory);
          await newHistory.save();
          stats.pushed++;
        } catch (e) {
          stats.errors.push(`History push failed: ${e.message}`);
        }
      }
    }

    console.log(`Sync completed for user ${userId}. Pulled: ${stats.pulled}, Pushed: ${stats.pushed}`);
    return { success: true, stats };
  } catch (error) {
    console.error('Error in sync engine:', error.message);
    return { success: false, error: error.message, stats };
  }
};

module.exports = {
  syncWithCloud
};
