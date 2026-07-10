const mongoose = require('mongoose');
const Topic = require('../models/Topic');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/memora');

const testTopics = [
  {
    title: "JavaScript Promises & Async/Await",
    content: "Understanding asynchronous programming in JavaScript with Promises and async/await syntax. Key concepts include promise chaining, error handling, and parallel execution.",
    difficulty: 4,
    category: "Technology",
    tags: ["javascript", "async", "promises", "programming"]
  },
  {
    title: "Organic Chemistry - Alkenes & Alkynes",
    content: "Study of unsaturated hydrocarbons including their structure, properties, and reactions. Focus on addition reactions, polymerization, and stereochemistry.",
    difficulty: 5,
    category: "Science",
    tags: ["chemistry", "organic", "hydrocarbons", "reactions"]
  },
  {
    title: "World War II Timeline",
    content: "Major events and dates of World War II from 1939-1945. Key battles, political decisions, and turning points that shaped the outcome of the war.",
    difficulty: 2,
    category: "History",
    tags: ["history", "wwii", "timeline", "events"]
  },
  {
    title: "Calculus - Integration by Parts",
    content: "Advanced integration technique using the formula ∫u dv = uv - ∫v du. Practice with trigonometric, exponential, and logarithmic functions.",
    difficulty: 4,
    category: "Mathematics",
    tags: ["calculus", "integration", "mathematics", "formulas"]
  },
  {
    title: "Spanish Vocabulary - Business Terms",
    content: "Essential Spanish vocabulary for business contexts including meetings, negotiations, finance, and professional communication.",
    difficulty: 2,
    category: "Language",
    tags: ["spanish", "vocabulary", "business", "language"]
  }
];

async function addTestTopics() {
  try {
    // Find the first user (or create a test user)
    let user = await User.findOne();
    
    if (!user) {
      console.log('No users found. Please register a user first.');
      process.exit(1);
    }

    console.log(`Adding test topics for user: ${user.email}`);

    // Add topics for this user
    for (const topicData of testTopics) {
      const topic = new Topic({
        ...topicData,
        userId: user._id,
        // Set some topics as due for review
        nextReviewDate: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000) // Some overdue, some due today
      });

      await topic.save();
      console.log(`✅ Added topic: ${topic.title}`);
    }

    console.log('\n🎉 All test topics added successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Error adding test topics:', error);
    process.exit(1);
  }
}

addTestTopics();
