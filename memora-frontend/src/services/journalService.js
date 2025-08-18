class JournalService {
  constructor() {
    this.activities = [];
    this.settings = this.loadSettings();
    this.currentUserId = null;
  }

  // Set current user for user-specific storage
  setCurrentUser(userId) {
    this.currentUserId = userId;
    this.settings = this.loadSettings(); // Reload settings for this user
    console.log('📝 Journal: User set to', userId, 'with settings:', this.settings);
  }

  // Get user-specific localStorage key
  getUserStorageKey(key) {
    return this.currentUserId ? `${key}_${this.currentUserId}` : key;
  }

  loadSettings() {
    const key = this.getUserStorageKey('journalSettings');
    const saved = localStorage.getItem(key);
    const defaultSettings = {
      autoJournal: true, // Enable by default for better UX
      autoPush: false,
      githubRepo: '',
      githubToken: '',
      journalFormat: 'markdown',
      dailyPushTime: '23:59'
    };

    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  }

  saveSettings(settings) {
    this.settings = settings;
    localStorage.setItem(this.getUserStorageKey('journalSettings'), JSON.stringify(settings));
  }

  // Log different types of activities
  logTopicAdded(topic) {
    if (!this.currentUserId) {
      console.warn('📝 Journal: No user set, skipping activity log');
      return;
    }

    console.log('📝 Journal: Logging topic added:', topic);

    const activity = {
      type: 'topic_added',
      timestamp: new Date().toISOString(),
      data: {
        title: topic.title,
        difficulty: topic.difficulty,
        tags: topic.tags || []
      }
    };

    this.addActivity(`📚 Added new topic: "${topic.title}" (Difficulty: ${topic.difficulty}/5)`);
  }

  logTopicReviewed(topic, performance) {
    if (!this.currentUserId) {
      console.warn('📝 Journal: No user set, skipping activity log');
      return;
    }

    console.log('📝 Journal: Logging topic reviewed:', topic, performance);

    const performanceText = performance === 'easy' ? '✅ Easy' :
                           performance === 'good' ? '👍 Good' :
                           performance === 'hard' ? '😅 Hard' : '❌ Failed';

    const topicTitle = topic?.title || 'Unknown Topic';
    const topicDesc = topic?.content ? ` (${topic.content.substring(0, 50)}${topic.content.length > 50 ? '...' : ''})` : '';

    this.addActivity(`🔄 Reviewed "${topicTitle}"${topicDesc} - ${performanceText}`);
  }

  logTopicSkipped(topic) {
    console.log('📝 Journal: Logging topic skipped:', topic);

    const topicTitle = topic?.title || 'Unknown Topic';
    const topicDesc = topic?.content ? ` (${topic.content.substring(0, 50)}${topic.content.length > 50 ? '...' : ''})` : '';

    this.addActivity(`⏭️ Skipped "${topicTitle}"${topicDesc} - Will review later`);
  }

  logTopicEdited(originalTopic, updatedData) {
    console.log('📝 Journal: Logging topic edited:', originalTopic, updatedData);

    const topicTitle = originalTopic?.title || updatedData?.title || 'Unknown Topic';
    const changes = [];

    if (originalTopic?.title !== updatedData?.title) {
      changes.push(`title: "${originalTopic?.title}" → "${updatedData?.title}"`);
    }
    if (originalTopic?.difficulty !== updatedData?.difficulty) {
      changes.push(`difficulty: ${originalTopic?.difficulty} → ${updatedData?.difficulty}`);
    }

    const changeText = changes.length > 0 ? ` (${changes.join(', ')})` : '';
    this.addActivity(`✏️ Edited "${topicTitle}"${changeText}`);
  }

  logDailySessionStart() {
    const today = new Date().toISOString().split('T')[0];
    const sessionKey = `session_logged_${today}`;

    // Only log once per day
    if (!localStorage.getItem(sessionKey)) {
      console.log('📝 Journal: Logging daily session start');
      this.addActivity(`🌅 Started learning session`);
      localStorage.setItem(sessionKey, 'true');
    }
  }

  logMemScoreEvaluation(results) {
    console.log('📝 Journal: Logging MemScore evaluation:', results);

    const score = results.overallScore || 0;
    this.addActivity(`🧠 Completed MemScore evaluation - Score: ${score.toFixed(1)}/10`);
  }

  logFocusSession(duration, topicsStudied = []) {
    console.log('📝 Journal: Logging focus session:', duration, topicsStudied);

    const minutes = Math.round(duration / 60000); // Convert ms to minutes
    let activity = `⏱️ Focus session: ${minutes} minutes`;

    if (topicsStudied.length > 0) {
      activity += ` (${topicsStudied.length} topics)`;
    }

    this.addActivity(activity);
  }

  logStudyStreak(currentStreak, isNewRecord = false) {
    console.log('📝 Journal: Study streak logging disabled to prevent spam');
    // Study streak logging disabled - was causing too many duplicate entries
    return;
  }

  logMemScoreUpdate(oldScore, newScore) {
    if (!this.settings.autoJournal) return;
    
    const change = newScore - oldScore;
    const changeText = change > 0 ? `+${change.toFixed(1)}` : change.toFixed(1);
    
    this.addActivity(`🧠 MemScore updated: ${oldScore.toFixed(1)} → ${newScore.toFixed(1)} (${changeText})`);
  }

  addActivity(activityText) {
    if (!this.currentUserId) {
      console.warn('📝 Journal: No user set, cannot add activity');
      return;
    }

    console.log('📝 Journal: Adding activity:', activityText);

    const today = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const activity = `[${timestamp}] ${activityText}`;
    console.log('📝 Journal: Formatted activity:', activity);

    // Get today's activities
    const todayActivities = this.getTodayActivities();
    console.log('📝 Journal: Current activities:', todayActivities);

    // Check for duplicates to avoid spam
    const isDuplicate = todayActivities.some(existingActivity =>
      existingActivity.includes(activityText.substring(0, 50))
    );

    if (isDuplicate) {
      console.log('📝 Journal: Duplicate activity detected, skipping');
      return;
    }

    todayActivities.push(activity);
    console.log('📝 Journal: Updated activities:', todayActivities);

    // Save to localStorage with user-specific key
    localStorage.setItem(this.getUserStorageKey(`activities_${today}`), JSON.stringify(todayActivities));
    console.log('📝 Journal: Saved to localStorage with key:', this.getUserStorageKey(`activities_${today}`));

    // Update journal entry only if auto-journal is enabled
    if (this.settings.autoJournal) {
      this.updateJournalEntry();
    }
  }

  getTodayActivities() {
    const today = new Date().toISOString().split('T')[0];
    const saved = localStorage.getItem(this.getUserStorageKey(`activities_${today}`));
    return saved ? JSON.parse(saved) : [];
  }

  updateJournalEntry() {
    if (!this.settings.autoJournal) {
      console.log('📝 Journal: Auto-journal disabled, skipping update');
      return;
    }

    console.log('📝 Journal: Updating journal entry...');

    const today = new Date().toISOString().split('T')[0];
    const activities = this.getTodayActivities();
    console.log('📝 Journal: Activities for today:', activities);

    // Get existing journal entry with user-specific key
    let journalEntry = localStorage.getItem(this.getUserStorageKey(`journal_${today}`)) || this.generateInitialEntry();
    console.log('📝 Journal: Current journal entry exists:', !!localStorage.getItem(this.getUserStorageKey(`journal_${today}`)));

    // Update the activities section
    const activitiesSection = activities.length > 0 ?
      activities.map(activity => `- ${activity}`).join('\n') :
      '- No activities logged yet';
    console.log('📝 Journal: Activities section:', activitiesSection);

    // Replace the activities section in the journal
    journalEntry = journalEntry.replace(
      /## 🎯 Today's Activities[\s\S]*?(?=\n## |$)/,
      `## 🎯 Today's Activities\n${activitiesSection}\n`
    );
    console.log('📝 Journal: Updated journal entry');

    // Update study summary
    const topicCount = activities.filter(a =>
      a.includes('📚 Added new topic') ||
      a.includes('🔄 Reviewed "') ||
      a.includes('Added new topic') ||
      a.includes('Reviewed "')
    ).length;
    const focusSessions = activities.filter(a =>
      a.includes('⏱️ Focus session:') ||
      a.includes('Focus session:')
    ).length;
    const totalTime = this.calculateTotalStudyTime(activities);

    journalEntry = journalEntry.replace(
      /- \*\*Topics Reviewed\*\*: \d+/,
      `- **Topics Reviewed**: ${topicCount}`
    );
    journalEntry = journalEntry.replace(
      /- \*\*Focus Sessions\*\*: \d+/,
      `- **Focus Sessions**: ${focusSessions}`
    );
    journalEntry = journalEntry.replace(
      /- \*\*Total Study Time\*\*: \d+ minutes/,
      `- **Total Study Time**: ${totalTime} minutes`
    );

    // Save updated journal entry with user-specific key
    localStorage.setItem(this.getUserStorageKey(`journal_${today}`), journalEntry);
    console.log('📝 Journal: Saved updated journal entry to localStorage with key:', this.getUserStorageKey(`journal_${today}`));
    console.log('📝 Journal: Study summary updated - Topics:', topicCount, 'Focus Sessions:', focusSessions, 'Total Time:', totalTime);

    // Trigger a custom event to notify the Journal component
    window.dispatchEvent(new CustomEvent('journalUpdated', {
      detail: { date: today, content: journalEntry }
    }));
  }

  calculateTotalStudyTime(activities) {
    let totalMinutes = 0;
    
    activities.forEach(activity => {
      const match = activity.match(/Focus session: (\d+) minutes/);
      if (match) {
        totalMinutes += parseInt(match[1]);
      }
    });
    
    return totalMinutes;
  }

  generateInitialEntry() {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    return `# Learning Journal - ${dateStr}

## 📚 Study Summary
- **Topics Reviewed**: 0
- **Focus Sessions**: 0
- **Total Study Time**: 0 minutes

## 🎯 Today's Activities
- No activities logged yet

## 💭 Reflections
*What did I learn today?*


*What challenges did I face?*


*What will I focus on tomorrow?*


## 📊 Progress Notes
*Any insights about my learning patterns or memory retention?*


---
*Auto-generated by Memora Learning Journal*`;
  }

  // GitHub integration
  async pushToGitHub() {
    if (!this.settings.githubRepo || !this.settings.githubToken) {
      throw new Error('GitHub repository and token must be configured');
    }

    const today = new Date().toISOString().split('T')[0];
    const journalEntry = localStorage.getItem(this.getUserStorageKey(`journal_${today}`));

    if (!journalEntry) {
      throw new Error('No journal entry found for today');
    }

    const fileName = `${today}.md`;
    const content = btoa(unescape(encodeURIComponent(journalEntry))); // Base64 encode

    try {
      // Check if file exists
      const checkResponse = await fetch(
        `https://api.github.com/repos/${this.settings.githubRepo}/contents/${fileName}`,
        {
          headers: {
            'Authorization': `token ${this.settings.githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      let sha = null;
      if (checkResponse.ok) {
        const fileData = await checkResponse.json();
        sha = fileData.sha;
      }

      // Create or update file
      const response = await fetch(
        `https://api.github.com/repos/${this.settings.githubRepo}/contents/${fileName}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${this.settings.githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `Learning journal entry for ${today}`,
            content: content,
            ...(sha && { sha })
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to push to GitHub');
      }

      return await response.json();
    } catch (error) {
      console.error('GitHub push error:', error);
      throw error;
    }
  }

  // Schedule daily push
  scheduleDailyPush() {
    if (!this.settings.autoPush) return;

    const now = new Date();
    const [hours, minutes] = this.settings.dailyPushTime.split(':');
    const pushTime = new Date();
    pushTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // If push time has passed today, schedule for tomorrow
    if (pushTime <= now) {
      pushTime.setDate(pushTime.getDate() + 1);
    }

    const timeUntilPush = pushTime.getTime() - now.getTime();

    setTimeout(async () => {
      try {
        await this.pushToGitHub();
        console.log('Daily journal pushed to GitHub successfully');
        
        // Schedule next push
        this.scheduleDailyPush();
      } catch (error) {
        console.error('Failed to push daily journal:', error);
        
        // Retry in 1 hour
        setTimeout(() => this.scheduleDailyPush(), 60 * 60 * 1000);
      }
    }, timeUntilPush);
  }

  // Initialize the service
  init() {
    if (this.settings.autoPush) {
      this.scheduleDailyPush();
    }
  }
}

// Create singleton instance
const journalService = new JournalService();

export default journalService;
