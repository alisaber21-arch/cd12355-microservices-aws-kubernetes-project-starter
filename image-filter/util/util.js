const Jimp = require("jimp");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");

const DOWNLOAD_TIMEOUT_MS = 10_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

class ImageFilterError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "ImageFilterError";
    this.statusCode = statusCode;
  }
}

async function downloadImage(inputURL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(inputURL, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent": "Udacity-Image-Filter/1.0"
      },
      redirect: "follow",
      signal: controller.signal
    });
  } catch (error) {
    throw new ImageFilterError("The image URL could not be accessed.", 422);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new ImageFilterError("The image URL could not be accessed.", 422);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && !contentType.toLowerCase().startsWith("image/")) {
    throw new ImageFilterError("The URL does not point to an image.", 415);
  }

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
    throw new ImageFilterError("The image is too large to process.", 422);
  }

  if (!response.body) {
    throw new ImageFilterError("The image URL could not be accessed.", 422);
  }

  const chunks = [];
  let bytesRead = 0;

  try {
    for await (const chunk of response.body) {
      const buffer = Buffer.from(chunk);
      bytesRead += buffer.length;

      if (bytesRead > MAX_IMAGE_BYTES) {
        throw new ImageFilterError("The image is too large to process.", 422);
      }

      chunks.push(buffer);
    }
  } catch (error) {
    if (error instanceof ImageFilterError) {
      throw error;
    }

    throw new ImageFilterError("The image URL could not be accessed.", 422);
  }

  return Buffer.concat(chunks);
}

/**
 * Downloads an image, applies the Udacity grayscale/resize filter, and returns
 * the temporary JPEG path. The caller is responsible for deleting that file.
 */
async function filterImageFromURL(inputURL) {
  const imageBuffer = await downloadImage(inputURL);

  let image;
  try {
    image = await Jimp.read(imageBuffer);
  } catch (error) {
    throw new ImageFilterError("The URL does not contain a supported image.", 415);
  }

  const outputPath = path.join(os.tmpdir(), `filtered.${randomUUID()}.jpg`);

  try {
    await image.resize(256, Jimp.AUTO).quality(60).greyscale().writeAsync(outputPath);
    return outputPath;
  } catch (error) {
    throw new ImageFilterError("The filtered image could not be created.", 500);
  }
}

async function deleteLocalFiles(files) {
  await Promise.all(
    files.map(async (file) => {
      try {
        await fs.unlink(file);
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.error(`Unable to delete temporary file ${file}:`, error);
        }
      }
    })
  );
}

module.exports = { filterImageFromURL, deleteLocalFiles, ImageFilterError };
