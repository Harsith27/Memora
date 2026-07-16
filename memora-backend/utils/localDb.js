const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create local database directory:', err.message);
  }
}

const getFilePath = (collection) => path.join(DATA_DIR, `${collection}.json`);

const readCollection = (collection) => {
  const filePath = getFilePath(collection);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content || '[]');
  } catch (e) {
    console.error(`Error reading collection ${collection}:`, e.message);
    return [];
  }
};

const writeCollection = (collection, data) => {
  const filePath = getFilePath(collection);
  const tempPath = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
    return true;
  } catch (e) {
    console.error(`Error writing collection ${collection}:`, e.message);
    // Cleanup temp if it exists
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }
    return false;
  }
};

const saveItem = (collection, item) => {
  if (!item) return false;
  const id = String(item._id || item.id);
  if (!id) return false;
  
  const data = readCollection(collection);
  const index = data.findIndex(d => String(d._id || d.id) === id);
  
  // Convert mongoose doc to plain object if needed
  const plainItem = typeof item.toObject === 'function' ? item.toObject() : item;
  
  if (index >= 0) {
    data[index] = { ...data[index], ...plainItem };
  } else {
    data.push(plainItem);
  }
  return writeCollection(collection, data);
};

const deleteItem = (collection, itemId) => {
  const id = String(itemId);
  if (!id) return false;
  const data = readCollection(collection);
  const filtered = data.filter(d => String(d._id || d.id) !== id);
  return writeCollection(collection, filtered);
};

module.exports = {
  readCollection,
  writeCollection,
  saveItem,
  deleteItem
};
