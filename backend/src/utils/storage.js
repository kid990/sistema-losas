const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");
const { env } = require("../config/env");

const isConfigured = !!(
  env.STORAGE_ENDPOINT &&
  env.STORAGE_ACCESS_KEY_ID &&
  env.STORAGE_SECRET_ACCESS_KEY &&
  env.STORAGE_BUCKET
);

let s3Client = null;

if (isConfigured) {
  s3Client = new S3Client({
    endpoint: env.STORAGE_ENDPOINT,
    region: env.STORAGE_REGION || "us-east-1",
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
}

async function uploadFile(fileObject) {
  if (!isConfigured) {
    throw new Error(
      "Storage no configurado. Define STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY y STORAGE_BUCKET en .env"
    );
  }

  const { buffer, originalname, mimetype } = fileObject;
  const ext = originalname.split(".").pop();
  const key = `permisos/${crypto.randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: env.STORAGE_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimetype || "application/octet-stream",
  });

  await s3Client.send(command);

  const publicUrl = `${env.STORAGE_ENDPOINT}/${env.STORAGE_BUCKET}/${key}`;
  return { url: publicUrl, key };
}

module.exports = { uploadFile };
