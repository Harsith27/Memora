const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Topic = require('../models/Topic');
const User = require('../models/User');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/memora';

const subjectTopics = [
  {
    title: 'Calculus - Chain Rule Applications',
    content: 'Differentiate composite functions using chain rule, with focus on trigonometric and exponential compositions.',
    category: 'Mathematics',
    difficulty: 4,
    tags: ['calculus', 'derivatives', 'chain-rule', 'practice'],
  },
  {
    title: 'Linear Algebra - Eigenvalues and Eigenvectors',
    content: 'Compute eigenvalues and eigenvectors for 2x2 and 3x3 matrices and understand diagonalization basics.',
    category: 'Mathematics',
    difficulty: 5,
    tags: ['linear-algebra', 'matrices', 'eigenvalues'],
  },
  {
    title: 'Physics - Newtons Laws and Free Body Diagrams',
    content: 'Apply Newtons laws to motion problems and construct free body diagrams for inclined planes and pulleys.',
    category: 'Science',
    difficulty: 3,
    tags: ['physics', 'mechanics', 'newton-laws'],
  },
  {
    title: 'Physics - Work, Energy and Power',
    content: 'Understand kinetic and potential energy conversions and solve work-energy theorem problems.',
    category: 'Science',
    difficulty: 3,
    tags: ['physics', 'energy', 'power'],
  },
  {
    title: 'Organic Chemistry - Reaction Mechanisms',
    content: 'Study nucleophilic substitution and elimination pathways with reaction condition comparisons.',
    category: 'Science',
    difficulty: 5,
    tags: ['chemistry', 'organic', 'mechanisms'],
  },
  {
    title: 'Biology - Cell Signaling Pathways',
    content: 'Review receptor signaling, second messengers, and feedback loops in cellular communication.',
    category: 'Science',
    difficulty: 4,
    tags: ['biology', 'cell-signaling', 'pathways'],
  },
  {
    title: 'History - French Revolution Timeline',
    content: 'Map major events from 1789 to the rise of Napoleon and connect causes with socio-political outcomes.',
    category: 'History',
    difficulty: 2,
    tags: ['history', 'french-revolution', 'timeline'],
  },
  {
    title: 'History - World War I Causes and Alliances',
    content: 'Analyze nationalism, imperialism, militarism and alliance structures leading to the outbreak of WWI.',
    category: 'History',
    difficulty: 2,
    tags: ['history', 'world-war-1', 'alliances'],
  },
  {
    title: 'English Literature - Shakespearean Tragedy Themes',
    content: 'Examine fate, ambition and moral conflict in key Shakespearean tragedies with textual references.',
    category: 'Language',
    difficulty: 3,
    tags: ['english', 'literature', 'shakespeare'],
  },
  {
    title: 'English Grammar - Advanced Sentence Correction',
    content: 'Practice parallelism, modifier placement, subject-verb agreement and concise style.',
    category: 'Language',
    difficulty: 2,
    tags: ['english', 'grammar', 'editing'],
  },
  {
    title: 'Computer Science - Time and Space Complexity',
    content: 'Compare asymptotic growth rates and analyze algorithm complexity using Big-O notation.',
    category: 'Technology',
    difficulty: 3,
    tags: ['computer-science', 'algorithms', 'big-o'],
  },
  {
    title: 'Data Structures - Binary Search Trees',
    content: 'Implement insertion, traversal and deletion operations and reason about balanced vs unbalanced trees.',
    category: 'Technology',
    difficulty: 4,
    tags: ['data-structures', 'trees', 'algorithms'],
  },
  {
    title: 'Database Systems - SQL Joins Deep Dive',
    content: 'Practice inner, left, right and full joins with performance-aware query design.',
    category: 'Technology',
    difficulty: 3,
    tags: ['sql', 'databases', 'joins'],
  },
  {
    title: 'Economics - Demand and Supply Elasticity',
    content: 'Calculate elasticity coefficients and evaluate market scenarios under changing price points.',
    category: 'Business',
    difficulty: 2,
    tags: ['economics', 'elasticity', 'markets'],
  },
  {
    title: 'Accounting - Trial Balance and Adjusting Entries',
    content: 'Prepare trial balances and post adjusting entries for accruals, deferrals and depreciation.',
    category: 'Business',
    difficulty: 3,
    tags: ['accounting', 'trial-balance', 'journal-entries'],
  },
  {
    title: 'Geography - Monsoon and Climate Patterns',
    content: 'Understand atmospheric circulation, pressure systems and regional monsoon behavior.',
    category: 'Other',
    difficulty: 2,
    tags: ['geography', 'climate', 'monsoon'],
  },
  {
    title: 'Political Science - Constitutional Framework Basics',
    content: 'Review constitutional structure, separation of powers and amendment mechanisms.',
    category: 'Other',
    difficulty: 2,
    tags: ['political-science', 'constitution', 'governance'],
  },
  {
    title: 'Statistics - Probability Distributions',
    content: 'Differentiate binomial, Poisson and normal distributions with practical sampling examples.',
    category: 'Mathematics',
    difficulty: 4,
    tags: ['statistics', 'probability', 'distributions'],
  },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const randomFrom = (values) => values[randomInt(0, values.length - 1)];

async function getTargetUser() {
  const identifier = process.argv[2];
  if (!identifier) {
    return User.findOne().sort({ createdAt: 1 });
  }

  return User.findOne({
    $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
  });
}

async function seedDemoTopics() {
  try {
    await mongoose.connect(MONGODB_URI);

    const user = await getTargetUser();
    if (!user) {
      console.error('No target user found. Pass email/username or create a user first.');
      process.exit(1);
    }

    console.log(`Seeding demo topics for user: ${user.username} (${user.email})`);

    const now = new Date();
    const docsToCreate = [];

    for (let i = 0; i < subjectTopics.length; i += 1) {
      const base = subjectTopics[i];
      const learnedDaysAgo = randomInt(1, 30);
      const learnedDate = new Date(now.getTime() - learnedDaysAgo * 24 * 60 * 60 * 1000);

      const reviewCount = randomInt(1, 9);
      const repetitions = clamp(reviewCount - 1, 0, 8);
      const interval = randomInt(1, 14);

      const daysUntilReview = randomInt(-3, 18);
      const nextReviewDate = new Date(now.getTime() + daysUntilReview * 24 * 60 * 60 * 1000);
      nextReviewDate.setHours(8, 0, 0, 0);

      const safeDifficulty = clamp(base.difficulty + randomFrom([-1, 0, 0, 1]), 1, 5);

      docsToCreate.push({
        ...base,
        userId: user._id,
        difficulty: safeDifficulty,
        learnedDate,
        lastReviewed: new Date(learnedDate.getTime() + randomInt(1, 6) * 24 * 60 * 60 * 1000),
        reviewCount,
        repetitions,
        interval,
        easeFactor: Number((2.1 + Math.random() * 0.8).toFixed(2)),
        averagePerformance: Number((0.55 + Math.random() * 0.4).toFixed(2)),
        nextReviewDate,
        isLearning: repetitions < 3,
        rescheduleCount: randomInt(0, 2),
        isActive: true,
      });
    }

    let createdCount = 0;

    for (const doc of docsToCreate) {
      const existing = await Topic.findOne({ userId: user._id, title: doc.title });
      if (existing) {
        continue;
      }

      const topic = new Topic(doc);
      topic.createdAt = doc.learnedDate;
      topic.updatedAt = new Date(doc.learnedDate.getTime() + randomInt(0, 5) * 24 * 60 * 60 * 1000);
      await topic.save({ timestamps: false });
      createdCount += 1;
    }

    console.log(`Done. Added ${createdCount} new subject topics spread across the last 30 days.`);
    console.log('If needed, run again with a different user: node scripts/seedDemoTopicsLastMonth.js <email-or-username>');
  } catch (error) {
    console.error('Failed to seed demo topics:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedDemoTopics();
