const mongoose = require('mongoose');

const localUri = process.env.LOCAL_MONGODB_URI || 'mongodb://localhost:27017/memora';
const prodUri = process.env.PROD_MONGODB_URI;

if (!prodUri) {
  console.error('Missing PROD_MONGODB_URI environment variable.');
  process.exit(1);
}

const isSystemCollection = (name) => name.startsWith('system.');

async function getCounts(conn) {
  const collections = await conn.db.listCollections({}, { nameOnly: true }).toArray();
  const counts = {};

  for (const { name } of collections) {
    if (isSystemCollection(name)) continue;
    counts[name] = await conn.db.collection(name).countDocuments();
  }

  return counts;
}

async function migrateAll(localConn, prodConn) {
  const collections = await localConn.db.listCollections({}, { nameOnly: true }).toArray();

  for (const { name } of collections) {
    if (isSystemCollection(name)) continue;

    const source = localConn.db.collection(name);
    const target = prodConn.db.collection(name);
    const docs = await source.find({}).toArray();

    await target.deleteMany({});
    if (docs.length > 0) {
      await target.insertMany(docs, { ordered: false });
    }

    console.log(`MIGRATED ${name}: ${docs.length} docs`);
  }
}

async function main() {
  const localConn = await mongoose.createConnection(localUri).asPromise();
  const prodConn = await mongoose.createConnection(prodUri).asPromise();

  try {
    const beforeLocal = await getCounts(localConn);
    const beforeProd = await getCounts(prodConn);

    console.log('LOCAL_COUNTS_BEFORE', JSON.stringify(beforeLocal));
    console.log('PROD_COUNTS_BEFORE', JSON.stringify(beforeProd));

    await migrateAll(localConn, prodConn);

    const afterProd = await getCounts(prodConn);
    console.log('PROD_COUNTS_AFTER', JSON.stringify(afterProd));

    const user = await prodConn.db.collection('users').findOne(
      { username: 'Harsith27' },
      { projection: { username: 1, email: 1 } }
    );
    console.log('HARISTH27_EXISTS', Boolean(user));
  } finally {
    await localConn.close();
    await prodConn.close();
  }
}

main().catch((error) => {
  console.error('MIGRATION_ERROR', error.message);
  process.exit(1);
});
