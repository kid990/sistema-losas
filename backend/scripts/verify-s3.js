const { uploadFile, deleteFile, getSignedDownloadUrl } = require("../src/utils/storage");
const { env } = require("../src/config/env");

async function main() {
  const keys = [];

  try {
    const image = await uploadFile(
      {
        buffer: Buffer.from("Verificacion de imagen S3", "utf8"),
        originalname: "verificacion-imagen.jpg",
        mimetype: "image/jpeg",
      },
      env.S3_IMAGE_KEY_PREFIX
    );
    keys.push(image.key);
    const document = await uploadFile(
      {
        buffer: Buffer.from("%PDF-1.4 verificacion S3", "utf8"),
        originalname: "verificacion-documento.pdf",
        mimetype: "application/pdf",
      },
      env.S3_DOCUMENT_KEY_PREFIX
    );
    keys.push(document.key);

    if (!image.key.startsWith(`${env.S3_IMAGE_KEY_PREFIX}/`)) {
      throw new Error("La imagen no se guardo en su carpeta S3");
    }
    if (!document.key.startsWith(`${env.S3_DOCUMENT_KEY_PREFIX}/`)) {
      throw new Error("El documento no se guardo en su carpeta S3");
    }
    const signedUrl = await getSignedDownloadUrl(image.key);
    if (!signedUrl.startsWith("https://")) {
      throw new Error("S3 no genero una URL firmada valida");
    }
    const signedResponse = await fetch(signedUrl, { signal: AbortSignal.timeout(10000) });
    if (!signedResponse.ok) {
      throw new Error(`La URL firmada respondio HTTP ${signedResponse.status}`);
    }

    console.log("S3 Express: imagenes/ y documentos/ verificados.");
  } finally {
    if (keys.length) {
      await Promise.all(keys.map((key) => deleteFile(key)));
      console.log("S3 Express: archivo temporal eliminado.");
    }
  }
}

main().catch((error) => {
  console.error(`S3 Express: error de verificacion: ${error.message}`);
  process.exitCode = 1;
});
