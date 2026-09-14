const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");
const { env } = require("../config/env");

const isConfigured = !!(
  env.S3_ENDPOINT &&
  env.AWS_ACCESS_KEY_ID &&
  env.AWS_SECRET_ACCESS_KEY &&
  env.S3_BUCKET
);

let s3Client = null;

if (isConfigured) {
  s3Client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  });
}

function buildObjectUrl(key) {
  const endpoint = env.S3_ENDPOINT.replace(/\/$/, "");
  if (env.S3_FORCE_PATH_STYLE) {
    return `${endpoint}/${env.S3_BUCKET}/${key}`;
  }
  const url = new URL(endpoint);
  url.hostname = `${env.S3_BUCKET}.${url.hostname}`;
  url.pathname = `/${key}`;
  return url.toString();
}

async function uploadFile(fileObject, keyPrefix = env.S3_KEY_PREFIX) {
  if (!isConfigured) {
    throw new Error(
      "S3 no configurado. Define S3_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY y S3_BUCKET en .env"
    );
  }

  const { buffer, originalname, mimetype } = fileObject;
  const ext = originalname.split(".").pop();
  const prefix = keyPrefix.replace(/^\/+|\/+$/g, "");
  const key = `${prefix ? `${prefix}/` : ""}${crypto.randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimetype || "application/octet-stream",
  });

  await s3Client.send(command);

  const publicUrl = buildObjectUrl(key);
  return { url: publicUrl, key };
}

async function deleteFile(key) {
  if (!isConfigured || !key) return;
  await s3Client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

async function getSignedDownloadUrl(key) {
  if (!isConfigured) {
    throw new Error(
      "S3 no configurado. Define S3_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY y S3_BUCKET en .env"
    );
  }
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    { expiresIn: env.S3_SIGNED_URL_EXPIRES_SECONDS }
  );
}

function getObjectKey(storedValue) {
  if (!storedValue) return null;
  if (!/^https?:\/\//i.test(storedValue)) return storedValue.replace(/^\/+/, "");

  try {
    const storedUrl = new URL(storedValue);
    const endpointUrl = new URL(env.S3_ENDPOINT);
    const path = decodeURIComponent(storedUrl.pathname).replace(/^\/+/, "");
    const virtualHost = `${env.S3_BUCKET}.${endpointUrl.hostname}`;

    if (storedUrl.hostname === virtualHost) return path;
    if (storedUrl.hostname === endpointUrl.hostname) {
      const bucketPrefix = `${env.S3_BUCKET}/`;
      return path.startsWith(bucketPrefix) ? path.slice(bucketPrefix.length) : null;
    }
  } catch {
    return null;
  }

  return null;
}

async function getSignedStoredObjectUrl(storedValue) {
  const key = getObjectKey(storedValue);
  return key ? getSignedDownloadUrl(key) : storedValue;
}

module.exports = {
  uploadFile,
  deleteFile,
  getSignedDownloadUrl,
  getObjectKey,
  getSignedStoredObjectUrl,
};
