const express = require('express');

const router = express.Router();

const clampText = (value, maxLen) => String(value || '').trim().slice(0, maxLen);

const buildTemplateMindmap = (topic, includeDescriptions = true) => {
  const safeTopic = clampText(topic, 80) || 'Learning Topic';

  const sections = [
    {
      id: 'n1',
      label: 'Fundamentals',
      note: `Understand the core ideas behind ${safeTopic}.`,
      labels: [
        { title: 'Definition', info: `What ${safeTopic} is and why it matters.` },
        { title: 'Key Terms', info: `List and learn the important terms related to ${safeTopic}.` },
        { title: 'Prerequisites', info: `Identify what you should know before diving into ${safeTopic}.` }
      ]
    },
    {
      id: 'n2',
      label: 'Core Concepts',
      note: `Break ${safeTopic} into smaller concepts and connect them.`,
      labels: [
        { title: 'Main Components', info: `Find the major parts or ideas inside ${safeTopic}.` },
        { title: 'How It Works', info: `Understand the flow and interactions between concepts.` },
        { title: 'Mental Model', info: `Create a simple model to remember how ${safeTopic} behaves.` }
      ]
    },
    {
      id: 'n3',
      label: 'Practical Usage',
      note: `Apply ${safeTopic} to practical scenarios.`,
      labels: [
        { title: 'Real Example', info: `Use a real-world example where ${safeTopic} is applied.` },
        { title: 'Hands-On Task', info: `Do one small project or exercise with ${safeTopic}.` },
        { title: 'Common Tools', info: `List tools or resources used while working on ${safeTopic}.` }
      ]
    },
    {
      id: 'n4',
      label: 'Best Practices',
      note: `Follow proven approaches to learn and use ${safeTopic} effectively.`,
      labels: [
        { title: 'Do This', info: `List proven habits and patterns that improve outcomes.` },
        { title: 'Avoid This', info: `Capture mistakes and anti-patterns to avoid.` },
        { title: 'Quality Checks', info: `Define checks to validate your understanding and work.` }
      ]
    },
    {
      id: 'n5',
      label: 'Revision Plan',
      note: `Build a spaced review plan to retain ${safeTopic}.`,
      labels: [
        { title: 'Day 1 Review', info: `Quick recap right after first learning session.` },
        { title: 'Week 1 Review', info: `Revisit weak spots and test recall.` },
        { title: 'Month 1 Review', info: `Consolidate knowledge with practice and explanation.` }
      ]
    },
    {
      id: 'n6',
      label: 'Advanced Learning',
      note: `Deepen your understanding once basics of ${safeTopic} are clear.`,
      labels: [
        { title: 'Edge Cases', info: `Explore uncommon cases and limitations.` },
        { title: 'Comparison', info: `Compare ${safeTopic} with similar approaches.` },
        { title: 'Next Steps', info: `Pick the next advanced concept to learn.` }
      ]
    }
  ];

  const nodes = [
    {
      id: 'root',
      label: safeTopic,
      note: includeDescriptions ? `Mindmap overview for ${safeTopic}.` : '',
      labels: []
    },
    ...sections.map((section) => ({
      id: section.id,
      label: section.label,
      note: includeDescriptions ? section.note : '',
      labels: includeDescriptions ? section.labels : section.labels.map((label) => ({ title: label.title }))
    }))
  ];

  const edges = sections.map((section) => ({
    source: 'root',
    target: section.id
  }));

  return {
    title: `${safeTopic} Mindmap`,
    nodes,
    edges
  };
};

router.post('/generate-ai', (req, res) => {
  const topic = clampText(req.body?.topic, 120);
  const includeDescriptions = req.body?.includeDescriptions !== false;

  if (!topic || topic.length < 2) {
    return res.status(400).json({
      message: 'Topic must be at least 2 characters long'
    });
  }

  const mindmap = buildTemplateMindmap(topic, includeDescriptions);

  return res.json({
    success: true,
    mindmap,
    warning: 'Using template-based generation while AI route is being restored.'
  });
});

module.exports = router;
