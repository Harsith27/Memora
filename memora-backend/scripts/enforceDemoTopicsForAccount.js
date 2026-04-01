const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Topic = require('../models/Topic');
const User = require('../models/User');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/memora';
const targetEmail = process.argv[2] || 'veeracharan99@gmail.com';


const demoTitles = [
  'Calculus - Chain Rule Applications',
  'Linear Algebra - Eigenvalues and Eigenvectors',
  'Physics - Newtons Laws and Free Body Diagrams',
  'Physics - Work, Energy and Power',
  'Organic Chemistry - Reaction Mechanisms',
  'Biology - Cell Signaling Pathways',
  'History - French Revolution Timeline',
  'History - World War I Causes and Alliances',
  'English Literature - Shakespearean Tragedy Themes',
  'English Grammar - Advanced Sentence Correction',
  'Computer Science - Time and Space Complexity',
  'Data Structures - Binary Search Trees',
  'Database Systems - SQL Joins Deep Dive',
  'Economics - Demand and Supply Elasticity',
  'Accounting - Trial Balance and Adjusting Entries',
  'Geography - Monsoon and Climate Patterns',
  'Political Science - Constitutional Framework Basics',
  'Statistics - Probability Distributions',
];

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);

    const targetUser = await User.findOne({ email: targetEmail.toLowerCase() });
    if (!targetUser) {
      console.error(`Target user not found: ${targetEmail}`);
      process.exit(1);
    }

    const usersWithDemoTopics = await Topic.distinct('userId', { title: { $in: demoTitles } });

    let removedTotal = 0;
    for (const userId of usersWithDemoTopics) {
      if (String(userId) === String(targetUser._id)) {
        continue;
      }

      const result = await Topic.deleteMany({
        userId,
        title: { $in: demoTitles },
      });

      removedTotal += result.deletedCount || 0;
    }

    const targetCount = await Topic.countDocuments({
      userId: targetUser._id,
      title: { $in: demoTitles },
    });

    const othersRemaining = await Topic.countDocuments({
      userId: { $ne: targetUser._id },
      title: { $in: demoTitles },
    });

    console.log(`Target account: ${targetUser.email}`);
    console.log(`Target demo topic count: ${targetCount}`);
    console.log(`Removed from other accounts: ${removedTotal}`);
    console.log(`Remaining in other accounts: ${othersRemaining}`);
  } catch (error) {
    console.error('Failed to enforce account-specific demo topics:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
