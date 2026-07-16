const fs = require('fs');
const path = require('path');
const localDb = require('./localDb');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create backup directory:', err.message);
  }
}

const runBackup = () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup_${timestamp}.json`);
    
    const payload = {
      timestamp: new Date().toISOString(),
      topics: localDb.readCollection('topics'),
      doctags: localDb.readCollection('doctags'),
      revisionhistories: localDb.readCollection('revisionhistories'),
      users: localDb.readCollection('users')
    };
    
    fs.writeFileSync(backupPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`[Backup System] Weekly backup completed: ${backupPath}`);
    
    // Prune old backups (keep only the last 4)
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .map(f => ({ name: f, path: path.join(BACKUP_DIR, f), time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);
      
    if (files.length > 4) {
      const toDelete = files.slice(4);
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
        console.log(`[Backup System] Pruned old backup file: ${file.name}`);
      }
    }
  } catch (e) {
    console.error('[Backup System] Database backup failed:', e.message);
  }
};

const initBackupScheduler = () => {
  // Run first backup on startup after server stabilizes (10 seconds delay)
  setTimeout(runBackup, 10000);
  
  // Run once every 7 days (weekly)
  const MS_IN_A_WEEK = 7 * 24 * 60 * 60 * 1000;
  setInterval(runBackup, MS_IN_A_WEEK);
};

module.exports = {
  runBackup,
  initBackupScheduler
};
