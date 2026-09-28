const express = require("express");
const { filterImageFromURL, deleteLocalFiles, ImageFilterError } = require("./util/util");

const app = express();
const port = Number(process.env.PORT) || 8082;

function validateImageUrl(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

app.get("/filteredimage", async (req, res) => {
  const imageUrl = validateImageUrl(req.query.image_url);

  if (!imageUrl) {
    return res.status(400).json({
      error: "image_url must be a nonempty HTTP(S) URL."
    });
  }

  let filteredImagePath;
  let cleanedUp = false;
  const cleanup = async () => {
    if (!cleanedUp && filteredImagePath) {
      cleanedUp = true;
      await deleteLocalFiles([filteredImagePath]);
    }
  };

  try {
    filteredImagePath = await filterImageFromURL(imageUrl.toString());

    res.on("finish", cleanup);
    res.on("close", cleanup);

    return res.sendFile(filteredImagePath, (error) => {
      if (error && !res.headersSent) {
        res.status(500).json({ error: "Unable to send the filtered image." });
      }
    });
  } catch (error) {
    await cleanup();

    if (error instanceof ImageFilterError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error("Unexpected image filtering failure:", error);
    return res.status(500).json({ error: "Unexpected failure while filtering the image." });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.listen(port, () => {
  console.log(`Image Filter service listening on port ${port}`);
});

module.exports = app;
