import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";
import { v4 as uuid } from "uuid";

const storage = multer.diskStorage({
  destination(req, file, cb) {
    if (!req.memberFolder) {
      req.memberFolder = uuid();
    }

    const root = process.env.VERCEL ? path.join(os.tmpdir(), "saifee-rovers", "members") : path.join("uploads", "members");
    const folder = path.join(root, req.memberFolder);
    req.memberUploadFolder = folder;

    fs.mkdirSync(folder, {
      recursive: true,
    });

    cb(null, folder);
  },

  filename(req, file, cb) {
    const ext = path.extname(file.originalname);

    const filename = `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext.toLowerCase()}`;

    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/jpg"];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG and PNG images are allowed"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export default upload;

export const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const adminProfilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const eventMediaFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) cb(null, true);
  else cb(new Error("Only photo and video files are allowed"));
};

export const eventMediaUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: eventMediaFilter,
  limits: { fileSize: 100 * 1024 * 1024, files: 20 },
});

export const marketplaceMediaUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: eventMediaFilter,
  limits: { fileSize: 4 * 1024 * 1024, files: 8 },
});
