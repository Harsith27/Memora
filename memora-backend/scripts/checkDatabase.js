const mongoose = require('mongoose');
const User = require('../models/User');
const Topic = require('../models/Topic');
const RevisionHistory = require('../models/RevisionHistory');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/memora');

async function checkDatabase() {
  try {
    console.log('🔍 Checking Memora Database Contents...\n');

    // Check Users
    console.log('👥 USERS:');
    console.log('========');
    const users = await User.find({}).select('-password');
    if (users.length === 0) {
      console.log('❌ No users found in database');
    } else {
      users.forEach((user, index) => {
        console.log(`${index + 1}. Email: ${user.email}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   MemScore: ${user.memScore}`);
        console.log(`   Created: ${user.createdAt}`);
        console.log(`   Last Login: ${user.lastLogin}`);
        console.log('   ---');
      });
    }

    // Check Topics
    console.log('\n📚 TOPICS:');
    console.log('=========');
    const topics = await Topic.find({}).populate('userId', 'email username');
    if (topics.length === 0) {
      console.log('❌ No topics found in database');
    } else {
      topics.forEach((topic, index) => {
        console.log(`${index + 1}. Title: ${topic.title}`);
        console.log(`   User: ${topic.userId ? topic.userId.email : 'Unknown'}`);
        console.log(`   Difficulty: ${topic.difficulty}/5`);
        console.log(`   Category: ${topic.category || 'Uncategorized'}`);
        console.log(`   Next Review: ${topic.nextReviewDate}`);
        console.log(`   Created: ${topic.createdAt}`);
        console.log('   ---');
      });
    }

    // Check Revision History
    console.log('\n📊 REVISION HISTORY:');
    console.log('==================');
    const revisions = await RevisionHistory.find({}).populate('userId', 'email').populate('topicId', 'title');
    if (revisions.length === 0) {
      console.log('❌ No revision history found in database');
    } else {
      console.log(`✅ Found ${revisions.length} revision records`);
      // Show last 5 revisions
      const recentRevisions = revisions.slice(-5);
      recentRevisions.forEach((revision, index) => {
        console.log(`${index + 1}. Topic: ${revision.topicId ? revision.topicId.title : 'Unknown'}`);
        console.log(`   User: ${revision.userId ? revision.userId.email : 'Unknown'}`);
        console.log(`   Quality: ${revision.quality}/5`);
        console.log(`   Correct: ${revision.wasCorrect ? 'Yes' : 'No'}`);
        console.log(`   Date: ${revision.createdAt}`);
        console.log('   ---');
      });
    }

    // Database Statistics
    console.log('\n📈 DATABASE STATISTICS:');
    console.log('=====================');
    console.log(`Total Users: ${users.length}`);
    console.log(`Total Topics: ${topics.length}`);
    console.log(`Total Revisions: ${revisions.length}`);

    // Check database collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n🗄️  DATABASE COLLECTIONS:');
    console.log('========================');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });

    console.log('\n✅ Database check complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error checking database:', error);
    process.exit(1);
  }
}

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('✅ Connected to MongoDB');
  checkDatabase();
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});
