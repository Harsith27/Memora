const fs = require('fs');
const path = require('path');
const { BlobServiceClient } = require('@azure/storage-blob');

const FILE_STORAGE_PROVIDER = String(process.env.FILE_STORAGE_PROVIDER || 'local').toLowerCase();
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const AZURE_STORAGE_CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || 'uploads';

let containerClientPromise = null;

const sanitizeFileName = (fileName) => {
  const ext = path.extname(fileName || '').toLowerCase();
  const base = path.basename(fileName || 'file', ext);

  const safeBase = base
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70) || 'file';

  return `${safeBase}${ext}`;
};

const getUniqueFileName = (originalName) => {
  const safeName = sanitizeFileName(originalName);
  const ext = path.extname(safeName);
  const base = path.basename(safeName, ext);
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `${base}-${uniqueSuffix}${ext}`;
};

const getRequestBaseUrl = (req) => {
  if (!req) return '';

  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto
    ? String(forwardedProto).split(',')[0].trim()
    : req.protocol;
  const host = req.get('host');

  if (!host) return '';
  return `${protocol}://${host}`;
};

const withNoTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

const isAzureEnabled = () => (
  FILE_STORAGE_PROVIDER === 'azure' &&
  Boolean(AZURE_STORAGE_CONNECTION_STRING) &&
  Boolean(AZURE_STORAGE_CONTAINER_NAME)
);

const getContainerClient = async () => {
  if (containerClientPromise) {
    return containerClientPromise;
  }

  if (!isAzureEnabled()) {
    return null;
  }

  containerClientPromise = (async () => {
    const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    const client = blobServiceClient.getContainerClient(AZURE_STORAGE_CONTAINER_NAME);
    await client.createIfNotExists({ access: 'blob' });
    return client;
  })();

  return containerClientPromise;
};

const saveFileLocal = ({ file, folder, uniqueName, req }) => {
  const uploadDir = path.join(__dirname, '..', 'uploads', folder);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const absolutePath = path.join(uploadDir, uniqueName);
  fs.writeFileSync(absolutePath, file.buffer);

  const relativeUrl = `/uploads/${folder}/${uniqueName}`;
  const backendBase = withNoTrailingSlash(process.env.BACKEND_PUBLIC_URL || getRequestBaseUrl(req));

  return {
    filename: uniqueName,
    url: backendBase ? `${backendBase}${relativeUrl}` : relativeUrl,
    storageProvider: 'local',
    storageKey: `${folder}/${uniqueName}`
  };
};

const saveFileToStorage = async ({ file, folder = 'doctags', req }) => {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new Error('Invalid file payload for storage');
  }

  const uniqueName = getUniqueFileName(file.originalname || `${file.fieldname || 'file'}.bin`);
  const storageKey = `${folder}/${uniqueName}`;

  if (isAzureEnabled()) {
    try {
      const containerClient = await getContainerClient();
      const blobClient = containerClient.getBlockBlobClient(storageKey);

      await blobClient.uploadData(file.buffer, {
        blobHTTPHeaders: {
          blobContentType: file.mimetype || 'application/octet-stream'
        }
      });

      return {
        filename: uniqueName,
        url: blobClient.url,
        storageProvider: 'azure',
        storageKey
      };
    } catch (error) {
      console.warn('Azure upload failed, falling back to local storage:', error.message);
    }
  }

  return saveFileLocal({ file, folder, uniqueName, req });
};

module.exports = {
  saveFileToStorage,
  isAzureEnabled
};
