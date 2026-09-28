const axios = require("axios");
const Jimp = require("jimp");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");

class ImageFilterError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "ImageFilterError";
    this.statusCode = statusCode;
  }
}

/**
 * Downloads an image, applies the Udacity grayscale/resize filter, and returns
 * the temporary JPEG path. The caller is responsible for deleting that file.
 */
async function filterImageFromURL(inputURL) {
  let response;

  try {
    response = await axios.get(inputURL, {
      responseType: "arraybuffer",
      timeout: 10_000,
      maxContentLength: 10 * 1024 * 1024,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 300
    });
  } catch (error) {
    throw new ImageFilterError("The image URL could not be accessed.", 422);
  }

  const contentType = String(response.headers["content-type"] || "").toLowerCase();
  if (!contentType.startsWith("image/")) {
    throw new ImageFilterError("The URL does not point to an image.", 415);
  }

  let image;
  try {
    image = await Jimp.read(response.data);
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
