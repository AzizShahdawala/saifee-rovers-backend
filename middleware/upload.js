import multer from "multer";
import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";

const storage = multer.diskStorage({
  destination(req, file, cb) {
    if (!req.memberFolder) {
      req.memberFolder = uuid();
    }

    const folder = path.join("uploads", "members", req.memberFolder);

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

const profileStorage = multer.diskStorage({
  destination(req, file, cb) {
    const folder = path.join("uploads", "members", String(req.user.sub), "profile");
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename(req, file, cb) {
    cb(null, `profile-${Date.now()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

export const profilePhotoUpload = multer({
  storage: profileStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const adminProfileStorage = multer.diskStorage({
  destination(req, file, cb) {
    const folder = path.join("uploads", "admins", String(req.user.sub), "profile");
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename(req, file, cb) {
    cb(null, `profile-${Date.now()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

export const adminProfilePhotoUpload = multer({
  storage: adminProfileStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
