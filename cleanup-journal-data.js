// One-time cleanup script for journal data
// Run this in browser console to clean study streak spam

function cleanupJournalData() {
  console.log('🧹 Starting manual cleanup of journal data...');
  
  // Get current user from localStorage
  const currentUser = localStorage.getItem('currentUser');
  if (!currentUser) {
    console.log('❌ No user found');
    return;
  }
  
  const user = JSON.parse(currentUser);
  const getUserStorageKey = (key) => `${user.email}_${key}`;
  
  // Clean last 60 days of activity logs
  const today = new Date();
  const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
  
  let totalCleaned = 0;
  let daysProcessed = 0;
  
  for (let d = new Date(sixtyDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
    const dateString = d.toISOString().split('T')[0];
    const activitiesKey = getUserStorageKey(`activities_${dateString}`);
    const savedActivities = localStorage.getItem(activitiesKey);
    
    if (savedActivities) {
      try {
        const activities = JSON.parse(savedActivities);
        const originalCount = activities.length;
        
        // Filter out all study streak related entries
        const cleanedActivities = activities.filter(activity => 
          !activity.includes('Study streak') && 
          !activity.includes('study streak') &&
          !activity.includes('Started new study streak') &&
          !activity.includes('Milestone achieved') &&
          !activity.includes('New Record') &&
          !activity.includes('🔥') &&
          !activity.includes('🚀') &&
          !activity.includes('days (New Record!)') &&
          !activity.includes('days - Milestone achieved!')
        );
        
        if (cleanedActivities.length !== originalCount) {
          localStorage.setItem(activitiesKey, JSON.stringify(cleanedActivities));
          const cleaned = originalCount - cleanedActivities.length;
          totalCleaned += cleaned;
          console.log(`🧹 ${dateString}: Removed ${cleaned} streak entries`);
        }
        
        daysProcessed++;
      } catch (error) {
        console.error(`❌ Error cleaning ${dateString}:`, error);
      }
    }
  }
  
  // Clear cached summaries to force regeneration
  const keys = Object.keys(localStorage);
  let summariesCleared = 0;
  
  keys.forEach(key => {
    if (key.includes('weeklySummary') || key.includes('monthlySummary')) {
      localStorage.removeItem(key);
      summariesCleared++;
      console.log(`🧹 Cleared cached summary: ${key}`);
    }
  });
  
  console.log(`✅ Cleanup completed!`);
  console.log(`📊 Summary:`);
  console.log(`   - Days processed: ${daysProcessed}`);
  console.log(`   - Streak entries removed: ${totalCleaned}`);
  console.log(`   - Cached summaries cleared: ${summariesCleared}`);
  console.log(`🎉 Your journal is now clean! Refresh the page to see changes.`);
}

// Run the cleanup
cleanupJournalData();
