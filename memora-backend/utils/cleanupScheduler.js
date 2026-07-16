const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

const runCleanup = () => {
  if (!fs.existsSync(UPLOADS_DIR)) {
    return;
  }
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const now = Date.now();
    const AGE_LIMIT = 24 * 60 * 60 * 1000; // 24 hours
    
    let deletedCount = 0;
    
    for (const file of files) {
      if (file === '.gitkeep') continue; // Keep git keeps
      
      const filePath = path.join(UPLOADS_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile() && (now - stat.mtime.getTime()) > AGE_LIMIT) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      } catch (err) {
        console.error(`Failed to audit or delete file ${file}:`, err.message);
      }
    }
    
    if (deletedCount > 0) {
      console.log(`[Cleanup System] Cleaned up ${deletedCount} audio files older than 24 hours from uploads directory.`);
    }
  } catch (e) {
    console.error('[Cleanup System] Audio files cleanup failed:', e.message);
  }
};

const initCleanupScheduler = () => {
  // Run on startup (5 seconds delay)
  setTimeout(runCleanup, 5000);
  
  // Run once every 24 hours (daily)
  const MS_IN_A_DAY = 24 * 60 * 60 * 1000;
  setInterval(runCleanup, MS_IN_A_DAY);
};

module.exports = {
  runCleanup,
  initCleanupScheduler
};
