const mongoose = require('mongoose');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/memora');

async function fixMemScore() {
  try {
    console.log('🔍 Looking for users with MemScore > 10...\n');

    // Find all users with MemScore > 10 (these need to be fixed)
    const users = await User.find({ memScore: { $gt: 10 } });

    if (users.length === 0) {
      console.log('✅ No users found with MemScore > 10. All scores are already correct!');
      process.exit(0);
    }

    console.log(`📋 Found ${users.length} user(s) with MemScore > 10:`);
    
    for (const user of users) {
      const oldScore = user.memScore;
      const newScore = Math.min(10, Math.max(0, oldScore / 10)); // Convert from 0-100 scale to 0-10 scale
      
      console.log(`\n👤 User: ${user.username} (${user.email})`);
      console.log(`   Old MemScore: ${oldScore}`);
      console.log(`   New MemScore: ${newScore.toFixed(1)}`);
      
      // Update the user
      user.memScore = newScore;
      user.lastMemScoreUpdate = new Date();
      await user.save();
      
      console.log(`   ✅ Updated successfully!`);
    }

    console.log('\n🎉 All MemScores have been fixed!');
    console.log('📊 Summary:');
    console.log(`   - Users updated: ${users.length}`);
    console.log(`   - MemScore range is now: 0-10 (instead of 0-100)`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error fixing MemScores:', error);
    process.exit(1);
  }
}

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('✅ Connected to MongoDB');
  fixMemScore();
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

mongoose.connection.on('disconnected', () => {
  console.log('📡 Disconnected from MongoDB');
});
