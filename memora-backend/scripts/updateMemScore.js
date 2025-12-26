const mongoose = require('mongoose');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/memora');

async function updateMemScore() {
  try {
    console.log('🔍 Looking for Harsith account...\n');

    // Find user by username or email containing "harsith" (case insensitive)
    const user = await User.findOne({
      $or: [
        { username: { $regex: /harsith/i } },
        { email: { $regex: /harsith/i } },
        { email: 'veeracharan99@gmail.com' }
      ]
    });

    if (!user) {
      console.log('❌ No user found with username containing "Harsith" or email "veeracharan99@gmail.com"');
      
      // Let's check all users to see what's available
      const allUsers = await User.find({}).select('username email memScore');
      console.log('\n📋 All users in database:');
      if (allUsers.length === 0) {
        console.log('❌ No users found in database');
      } else {
        allUsers.forEach((u, index) => {
          console.log(`${index + 1}. Username: ${u.username}, Email: ${u.email}, MemScore: ${u.memScore}`);
        });
      }
      
      process.exit(1);
    }

    console.log('✅ Found user:');
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Current MemScore: ${user.memScore}`);

    // Update memScore from current value to 10.0
    const oldScore = user.memScore;
    user.memScore = 10.0;
    user.lastMemScoreUpdate = new Date();
    
    await user.save();

    console.log('\n🎉 MemScore updated successfully!');
    console.log(`   Old MemScore: ${oldScore}`);
    console.log(`   New MemScore: ${user.memScore}`);
    console.log(`   Updated at: ${user.lastMemScoreUpdate}`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error updating memScore:', error);
    process.exit(1);
  }
}

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('✅ Connected to MongoDB');
  updateMemScore();
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});
