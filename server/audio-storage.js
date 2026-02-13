import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { Storage } from "@google-cloud/storage";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localAudioDir = path.join(__dirname, "audio");

const BUCKET_NAME = process.env.BUCKET_NAME || process.env.GCS_BUCKET_NAME || "";
const AUDIO_PREFIX = process.env.AUDIO_PREFIX || "audio";

let storage = null;
let bucket = null;

if (BUCKET_NAME) {
  try {
    storage = new Storage();
    bucket = storage.bucket(BUCKET_NAME);
  } catch (error) {
    console.warn("Cloud Storage unavailable, fallback to local audio directory:", error?.message || error);
    storage = null;
    bucket = null;
  }
}

if (!fs.existsSync(localAudioDir)) {
  fs.mkdirSync(localAudioDir, { recursive: true });
}

const audioPath = (filename) => `${AUDIO_PREFIX}/${filename}`;

const parseFilenameFromAudioUrl = (audioUrl) => {
  if (!audioUrl) return null;
  const clean = String(audioUrl).split("?")[0];
  if (!clean.startsWith("/api/audio/")) return null;
  return clean.slice("/api/audio/".length);
};

const sendBufferRange = async ({ req, res, size, createReadStream }) => {
  const range = req.headers.range;
  if (!range) {
    res.status(200);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Length", size);
    createReadStream().pipe(res);
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
  if (!match) {
    res.status(416).setHeader("Content-Range", `bytes */${size}`);
    res.end();
    return;
  }

  const start = match[1] === "" ? 0 : Number(match[1]);
  const end = match[2] === "" ? size - 1 : Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end >= size) {
    res.status(416).setHeader("Content-Range", `bytes */${size}`);
    res.end();
    return;
  }

  res.status(206);
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
  res.setHeader("Content-Length", end - start + 1);
  createReadStream({ start, end }).pipe(res);
};

export const audioStorage = {
  isCloudStorageEnabled() {
    return Boolean(bucket);
  },
  async saveFromBuffer(filename, buffer) {
    if (bucket) {
      const file = bucket.file(audioPath(filename));
      await file.save(buffer, {
        resumable: false,
        metadata: { contentType: "audio/mpeg" },
      });
    } else {
      await fsp.writeFile(path.join(localAudioDir, filename), buffer);
    }
    return `/api/audio/${filename}`;
  },
  async deleteByUrl(audioUrl) {
    const filename = parseFilenameFromAudioUrl(audioUrl);
    if (!filename) return;
    if (bucket) {
      try {
        await bucket.file(audioPath(filename)).delete({ ignoreNotFound: true });
      } catch (error) {
        console.warn("Failed to delete audio object:", error?.message || error);
      }
      return;
    }

    const filepath = path.join(localAudioDir, filename);
    if (fs.existsSync(filepath)) {
      await fsp.unlink(filepath);
    }
  },
  async existsByUrl(audioUrl) {
    const filename = parseFilenameFromAudioUrl(audioUrl);
    if (!filename) return false;
    if (bucket) {
      const [exists] = await bucket.file(audioPath(filename)).exists();
      return exists;
    }
    return fs.existsSync(path.join(localAudioDir, filename));
  },
  async sendByFilename(req, res, filename) {
    if (bucket) {
      const file = bucket.file(audioPath(filename));
      const [exists] = await file.exists();
      if (!exists) {
        res.status(404).end();
        return;
      }
      const [metadata] = await file.getMetadata();
      const size = Number(metadata.size || 0);
      await sendBufferRange({
        req,
        res,
        size,
        createReadStream: (range) => file.createReadStream(range || {}),
      });
      return;
    }

    const filepath = path.join(localAudioDir, filename);
    if (!fs.existsSync(filepath)) {
      res.status(404).end();
      return;
    }
    const stat = await fsp.stat(filepath);
    await sendBufferRange({
      req,
      res,
      size: stat.size,
      createReadStream: (range) => fs.createReadStream(filepath, range || {}),
    });
  },
};
