require('dotenv').config();
const mongoose = require('mongoose');
const Topic = require('../models/Topic');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/memora';
const SEED_MARKER_TAG = 'seed-btech-software-v2';

const topicTemplates = [
  {
    title: 'Big-O Analysis for Nested Loops and Recursion',
    content: 'Analyze time and space complexity for nested loops, divide-and-conquer recursion, and amortized array operations.',
    category: 'Technology',
    difficulty: 3,
    estimatedMinutes: 35,
    tags: ['btech-software', 'subject-dsa', 'domain-algorithms', 'semester-3', 'unit-1']
  },
  {
    title: 'Arrays and Strings Sliding Window Patterns',
    content: 'Solve longest substring, fixed-size window, and variable-size window problems using two pointers.',
    category: 'Technology',
    difficulty: 2,
    estimatedMinutes: 30,
    tags: ['btech-software', 'subject-dsa', 'domain-problem-solving', 'semester-3', 'unit-1']
  },
  {
    title: 'Linked List Operations and Edge Cases',
    content: 'Practice reversing, cycle detection, middle node detection, and merge operations with pointer safety.',
    category: 'Technology',
    difficulty: 3,
    estimatedMinutes: 40,
    tags: ['btech-software', 'subject-dsa', 'domain-data-structures', 'semester-3', 'unit-1']
  },
  {
    title: 'Stacks, Queues, and Monotonic Stack Problems',
    content: 'Apply stack and queue abstractions to solve nearest greater element, expression evaluation, and balancing problems.',
    category: 'Technology',
    difficulty: 3,
    estimatedMinutes: 35,
    tags: ['btech-software', 'subject-dsa', 'domain-data-structures', 'semester-3', 'unit-2']
  },
  {
    title: 'Binary Search on Answer Technique',
    content: 'Use binary search on value ranges for optimization problems like minimum feasible capacity and maximum minimum distance.',
    category: 'Technology',
    difficulty: 4,
    estimatedMinutes: 45,
    tags: ['btech-software', 'subject-dsa', 'domain-algorithms', 'semester-3', 'unit-2']
  },
  {
    title: 'Trees Traversals and Lowest Common Ancestor',
    content: 'Implement DFS/BFS traversals and solve LCA in binary trees with recursive and iterative approaches.',
    category: 'Technology',
    difficulty: 4,
    estimatedMinutes: 45,
    tags: ['btech-software', 'subject-dsa', 'domain-trees', 'semester-4', 'unit-1']
  },
  {
    title: 'Heap and Priority Queue for Scheduling Problems',
    content: 'Use min-heap and max-heap for top-k, merge-k-sorted-lists, and task scheduling scenarios.',
    category: 'Technology',
    difficulty: 4,
    estimatedMinutes: 40,
    tags: ['btech-software', 'subject-dsa', 'domain-heaps', 'semester-4', 'unit-1']
  },
  {
    title: 'Graph BFS DFS and Topological Sort',
    content: 'Represent directed and undirected graphs and solve traversal, cycle detection, and ordering tasks.',
    category: 'Technology',
    difficulty: 4,
    estimatedMinutes: 50,
    tags: ['btech-software', 'subject-dsa', 'domain-graphs', 'semester-4', 'unit-2']
  },
  {
    title: 'Dynamic Programming 1D and 2D Patterns',
    content: 'Build recurrence relations and tabulation for knapsack, LIS, and grid path style questions.',
    category: 'Technology',
    difficulty: 5,
    estimatedMinutes: 55,
    tags: ['btech-software', 'subject-dsa', 'domain-dp', 'semester-4', 'unit-3']
  },
  {
    title: 'Operating System Process States and Scheduling',
    content: 'Understand FCFS, SJF, Round Robin, and starvation/aging with turnaround and waiting time calculations.',
    category: 'Technology',
    difficulty: 3,
    estimatedMinutes: 35,
    tags: ['btech-software', 'subject-os', 'domain-systems', 'semester-4', 'unit-1']
  },
  {
    title: 'OS Synchronization with Semaphores and Monitors',
    content: 'Solve producer-consumer, readers-writers, and deadlock conditions using synchronization primitives.',
    category: 'Technology',
    difficulty: 4,
    estimatedMinutes: 45,
    tags: ['btech-software', 'subject-os', 'domain-concurrency', 'semester-4', 'unit-2']
  },
  {
    title: 'Virtual Memory and Page Replacement Algorithms',
    content: 'Compare FIFO, LRU, and Optimal replacement along with TLB and demand paging concepts.',
    category: 'Technology',
    difficulty: 4,
    estimatedMinutes: 40,
    tags: ['btech-software', 'subject-os', 'domain-memory-management', 'semester-4', 'unit-3']
  },
  {
    title: 'DBMS Normalization and Functional Dependencies',
    content: 'Convert schema up to BCNF and reason about anomalies, decomposition, and dependency preservation.',
    category: 'Technology',
    difficulty: 3,
    estimatedMinutes: 35,
    tags: ['btech-software', 'subject-dbms', 'domain-databases', 'semester-3', 'unit-2']
  },
  {
    title: 'SQL Joins Grouping and Window Functions',
    content: 'Write queries with joins, aggregates, CTEs, and ranking functions for analytics workloads.',
    category: 'Technology',
    difficulty: 3,
    estimatedMinutes: 35,
    tags: ['btech-software', 'subject-dbms', 'domain-sql', 'semester-3', 'unit-3']
  },
  {
    title: 'Transactions, ACID, and Concurrency Control',
    content: 'Study serializability, locking protocols, isolation levels, and deadlock handling in transactional systems.',
    category: 'Technology',
    difficulty: 4,
    estimatedMinutes: 45,
    tags: ['btech-software', 'subject-dbms', 'domain-transactions', 'semester-4', 'unit-1']
  },
  {
    title: 'Computer Networks OSI and TCP/IP Mapping',
    content: 'Map protocols to layers and compare responsibilities across OSI and TCP/IP models.',
    category: 'Technology',
    difficulty: 2,
    estimatedMinutes: 30,
    tags: ['btech-software', 'subject-cn', 'domain-networks', 'semester-3', 'unit-1']
  },
  {
    title: 'Routing, Subnetting, and CIDR Fundamentals',
    content: 'Perform subnet calculations and understand static/dynamic routing behavior in IP networks.',
    category: 'Technology',
    difficulty: 3,
    estimatedMinutes: 35,
    tags: ['btech-software', 'subject-cn', 'domain-networking', 'semester-3', 'unit-2']
  },
  {
    title: 'TCP Congestion Control and Flow Control',
    content: 'Explain slow start, congestion avoidance, retransmission behavior, and sliding window flow control.',
    category: 'Technology',
    difficulty: 4,
    estimatedMinutes: 40,
    tags: ['btech-software', 'subject-cn', 'domain-transport-layer', 'semester-4', 'unit-1']
  },
  {
    title: 'Object-Oriented Design SOLID Principles',
    content: 'Apply SOLID principles to class design and improve maintainability of medium-sized codebases.',
    category: 'Technology',
    difficulty: 3,
    estimatedMinutes: 35,
    tags: ['btech-software', 'subject-oop', 'domain-design', 'semester-3', 'unit-1']
  },
  {
    title: 'Design Patterns Factory Strategy Observer',
    content: 'Use core creational and behavioral patterns in practical Java/C++ style implementations.',
    category: 'Technology',
    difficulty: 4,
    estimatedMinutes: 45,
    tags: ['btech-software', 'subject-oop', 'domain-design-patterns', 'semester-4', 'unit-2']
  },
  {
    title: 'Software Engineering Agile Scrum Workflow',
    content: 'Understand sprint planning, backlog grooming, retrospectives, and velocity estimation in teams.',
    category: 'Technology',
    difficulty: 2,
    estimatedMinutes: 30,
    tags: ['btech-software', 'subject-se', 'domain-process', 'semester-5', 'unit-1']
  },
  {
    title: 'UML Diagrams for Requirement to Design',
    content: 'Model use-case, class, sequence, and activity diagrams from software requirements.',
    category: 'Technology',
    difficulty: 3,
    estimatedMinutes: 35,
    tags: ['btech-software', 'subject-se', 'domain-modeling', 'semester-5', 'unit-1']
  },
  {
    title: 'Testing Pyramid and CI Quality Gates',
    content: 'Build unit, integration, and end-to-end test strategy with automated CI checks.',
    category: 'Technology',
    difficulty: 3,
    estimatedMinutes: 35,
    tags: ['btech-software', 'subject-se', 'domain-testing', 'semester-5', 'unit-2']
  },
  {
    title: 'Java Memory Model and Collections Performance',
    content: 'Study heap vs stack, garbage collection basics, and choose appropriate collections by workload.',
    category: 'Technology',
    difficulty: 4,
    estimatedMinutes: 45,
    tags: ['btech-software', 'subject-java', 'domain-runtime', 'semester-4', 'unit-2']
  },
  {
    title: 'Spring Boot REST API Layering',
    content: 'Design controller-service-repository architecture with validation, DTO mapping, and error handling.',
    category: 'Technology',
    difficulty: 3,
    estimatedMinutes: 40,
    tags: ['btech-software', 'subject-java', 'domain-backend', 'semester-5', 'unit-3']
  },
  {
    title: 'JavaScript Event Loop and Async Patterns',
    content: 'Understand microtasks, macrotasks, promise chains, async/await, and race conditions in web apps.',
    category: 'Technology',
    difficulty: 3,
    estimatedMinutes: 35,
    tags: ['btech-software', 'subject-web', 'domain-javascript', 'semester-5', 'unit-1']
  },
  {
    title: 'React State Management and Rendering Flow',
    content: 'Manage local and shared state, optimize re-renders, and structure feature-driven component trees.',
    category: 'Technology',
    difficulty: 3,
    estimatedMinutes: 40,
    tags: ['btech-software', 'subject-web', 'domain-frontend', 'semester-5', 'unit-2']
  },
  {
    title: 'Node.js API Security and JWT Auth',
    content: 'Implement secure auth flow, input validation, hashing, token refresh, and rate limiting controls.',
    category: 'Technology',
    difficulty: 4,
    estimatedMinutes: 45,
    tags: ['btech-software', 'subject-web', 'domain-backend', 'semester-5', 'unit-3']
  },
  {
    title: 'Compiler Basics Lexical and Syntax Analysis',
    content: 'Differentiate tokenization, parsing trees, and semantic checks in compiler front-end stages.',
    category: 'Technology',
    difficulty: 4,
    estimatedMinutes: 45,
    tags: ['btech-software', 'subject-compiler-design', 'domain-theory', 'semester-6', 'unit-1']
  },
  {
    title: 'Cloud Fundamentals IaaS PaaS SaaS Models',
    content: 'Compare cloud service models and choose architectures based on control, scalability, and cost.',
    category: 'Technology',
    difficulty: 2,
    estimatedMinutes: 30,
    tags: ['btech-software', 'subject-cloud', 'domain-architecture', 'semester-6', 'unit-1']
  },
  {
    title: 'Docker Image, Container, and Compose Basics',
    content: 'Package apps into containers, define compose services, and manage local multi-service workflows.',
    category: 'Technology',
    difficulty: 3,
    estimatedMinutes: 35,
    tags: ['btech-software', 'subject-devops', 'domain-containers', 'semester-6', 'unit-2']
  },
  {
    title: 'Kubernetes Core Objects and Deployments',
    content: 'Understand pods, deployments, services, config maps, and rollout strategy for production clusters.',
    category: 'Technology',
    difficulty: 5,
    estimatedMinutes: 55,
    tags: ['btech-software', 'subject-devops', 'domain-kubernetes', 'semester-7', 'unit-1']
  },
  {
    title: 'Machine Learning Bias Variance and Evaluation',
    content: 'Study underfitting/overfitting behavior and evaluate models using precision, recall, and F1.',
    category: 'Technology',
    difficulty: 4,
    estimatedMinutes: 45,
    tags: ['btech-software', 'subject-ml', 'domain-ai', 'semester-6', 'unit-2']
  },
  {
    title: 'Cryptography Hashing and Digital Signatures',
    content: 'Understand symmetric/asymmetric encryption, hashing properties, and signature verification flow.',
    category: 'Technology',
    difficulty: 4,
    estimatedMinutes: 40,
    tags: ['btech-software', 'subject-cybersecurity', 'domain-security', 'semester-6', 'unit-3']
  },
  {
    title: 'Discrete Mathematics Graphs and Recurrence',
    content: 'Practice recurrence solving, graph properties, and counting principles used in algorithm design.',
    category: 'Mathematics',
    difficulty: 3,
    estimatedMinutes: 35,
    tags: ['btech-software', 'subject-discrete-math', 'domain-foundations', 'semester-2', 'unit-2']
  },
  {
    title: 'Probability for Data Science Basics',
    content: 'Review conditional probability, Bayes theorem, and random variables for ML/statistical modeling.',
    category: 'Mathematics',
    difficulty: 3,
    estimatedMinutes: 35,
    tags: ['btech-software', 'subject-math', 'domain-probability', 'semester-3', 'unit-3']
  }
];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const sampleFirstReviewQuality = (difficulty) => {
  if (difficulty >= 5) {
    return [3, 3, 4][randomInt(0, 2)];
  }
  if (difficulty === 4) {
    return [3, 4, 4][randomInt(0, 2)];
  }
  return [4, 4, 5][randomInt(0, 2)];
};

const DISTRIBUTION_WINDOW_DAYS = 9;

const getWindowStart = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
};

const getScheduledReviewDate = (windowStart, index) => {
  const scheduled = new Date(windowStart);
  scheduled.setDate(scheduled.getDate() + (index % DISTRIBUTION_WINDOW_DAYS));
  scheduled.setHours(8, 0, 0, 0);
  return scheduled;
};

const getCompactTags = (templateTags = []) => {
  const subjectTag = templateTags.find((tag) => tag.startsWith('subject-'));
  const fallbackTag = templateTags.find((tag) => tag && tag !== SEED_MARKER_TAG) || 'subject-general';
  return [subjectTag || fallbackTag, SEED_MARKER_TAG];
};

async function getTargetUser() {
  const identifierArg = process.argv[2];
  if (!identifierArg || identifierArg === '--replace') {
    return User.findOne().sort({ createdAt: 1 });
  }

  return User.findOne({
    $or: [
      { email: identifierArg.toLowerCase() },
      { username: identifierArg }
    ]
  });
}

const shouldReplace = () => process.argv.includes('--replace');

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);

    const user = await getTargetUser();
    if (!user) {
      console.error('No target user found. Pass email/username or create a user first.');
      process.exit(1);
    }

    if (shouldReplace()) {
      const deleted = await Topic.deleteMany({ userId: user._id, tags: SEED_MARKER_TAG });
      console.log(`Removed ${deleted.deletedCount || 0} existing seeded topics for this user.`);
    }

    const now = new Date();
    const windowStart = getWindowStart();
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + (DISTRIBUTION_WINDOW_DAYS - 1));
    windowEnd.setHours(23, 59, 59, 999);

    let createdCount = 0;
    let skippedCount = 0;

    for (let index = 0; index < topicTemplates.length; index += 1) {
      const template = topicTemplates[index];
      const existing = await Topic.findOne({ userId: user._id, title: template.title });
      if (existing) {
        skippedCount += 1;
        continue;
      }

      const scheduledReviewDate = getScheduledReviewDate(windowStart, index);
      const dayOffset = Math.round((scheduledReviewDate.getTime() - windowStart.getTime()) / (24 * 60 * 60 * 1000));

      // Topics scheduled after day 0 represent already-studied items.
      const learnedDaysAgo = dayOffset === 0 ? randomInt(0, 1) : randomInt(2, 12);
      const learnedDate = new Date(now.getTime() - learnedDaysAgo * 24 * 60 * 60 * 1000);
      learnedDate.setHours(7, 0, 0, 0);

      const deadlineDaysAhead = randomInt(45, 140);
      const deadlineDate = new Date(scheduledReviewDate.getTime() + deadlineDaysAhead * 24 * 60 * 60 * 1000);
      deadlineDate.setHours(8, 0, 0, 0);

      const topic = new Topic({
        ...template,
        userId: user._id,
        tags: getCompactTags(template.tags),
        learnedDate,
        deadlineDate,
        deadlineType: template.difficulty >= 4 ? 'hard' : 'soft',
        nextReviewDate: scheduledReviewDate,
        isActive: true
      });

      await topic.save();

      if (dayOffset > 0) {
        const quality = sampleFirstReviewQuality(topic.difficulty);
        const responseTimeMs = randomInt(9000, 55000);
        await topic.updateSpacedRepetition(quality, responseTimeMs);

        // Preserve deterministic Apr-02..Apr-10-style spread after simulating "already revised once".
        topic.nextReviewDate = scheduledReviewDate;
        topic.repetitions = Math.max(topic.repetitions, 1);
        topic.reviewCount = Math.max(topic.reviewCount, 1);
        await topic.save();
      }

      createdCount += 1;
    }

    const groupedCounts = await Topic.aggregate([
      { $match: { userId: user._id, tags: SEED_MARKER_TAG, isActive: true } },
      { $unwind: '$tags' },
      { $match: { tags: { $regex: '^subject-' } } },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const distributionCounts = await Topic.aggregate([
      {
        $match: {
          userId: user._id,
          tags: SEED_MARKER_TAG,
          isActive: true,
          nextReviewDate: { $gte: windowStart, $lte: windowEnd }
        }
      },
      {
        $project: {
          day: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$nextReviewDate'
            }
          }
        }
      },
      { $group: { _id: '$day', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const tagCountStats = await Topic.aggregate([
      { $match: { userId: user._id, tags: SEED_MARKER_TAG, isActive: true } },
      { $project: { tagCount: { $size: '$tags' } } },
      {
        $group: {
          _id: null,
          minTags: { $min: '$tagCount' },
          maxTags: { $max: '$tagCount' },
          avgTags: { $avg: '$tagCount' }
        }
      }
    ]);

    const totalSeededForUser = await Topic.countDocuments({ userId: user._id, tags: SEED_MARKER_TAG, isActive: true });

    console.log(`Target user: ${user.username} (${user.email})`);
    console.log(`Created: ${createdCount}`);
    console.log(`Skipped existing: ${skippedCount}`);
    console.log(`Total active seeded topics: ${totalSeededForUser}`);
    console.log(`Window: ${windowStart.toISOString().split('T')[0]} to ${windowEnd.toISOString().split('T')[0]}`);
    console.log('Distribution counts by day in window:', distributionCounts);
    console.log('Grouped sample counts by subject tags:', groupedCounts);
    console.log('Tag count stats (expect max 2):', tagCountStats[0] || { minTags: 0, maxTags: 0, avgTags: 0 });
    console.log('Done. Seeded topics are distributed across the 9-day window; day 1+ topics are pre-reviewed once.');
  } catch (error) {
    console.error('Failed to seed BTech software topics:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
