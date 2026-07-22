import { randomUUID } from 'node:crypto';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { config } from './config.js';
import { HttpError } from './http.js';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, callback) =>
    callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});

export async function saveImage(file?: Express.Multer.File): Promise<string> {
  if (!file) throw new HttpError(400, 'IMAGE_REQUIRED', '상품 이미지가 필요합니다.');
  const image = sharp(file.buffer, { failOn: 'error', limitInputPixels: config.MAX_IMAGE_PIXELS });
  const metadata = await image.metadata().catch(() => {
    throw new HttpError(400, 'IMAGE_CONTENT_INVALID', '이미지 파일 내용을 확인해 주세요.');
  });
  if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format))
    throw new HttpError(400, 'IMAGE_TYPE_INVALID', 'JPEG, PNG, WebP 이미지만 허용합니다.');
  const dir = path.resolve(config.UPLOAD_DIR);
  // UPLOAD_DIR is a trusted deployment setting, not user input.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.webp`;
  const destination = path.join(dir, filename);
  if (path.dirname(destination) !== dir)
    throw new HttpError(400, 'IMAGE_PATH_INVALID', '잘못된 이미지 경로입니다.');
  await image
    .rotate()
    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(destination);
  return filename;
}

export async function removeImage(filename: string | null | undefined) {
  if (!filename || path.basename(filename) !== filename) return;
  // filename is constrained to basename above and UPLOAD_DIR is operator-controlled.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await unlink(path.join(path.resolve(config.UPLOAD_DIR), filename)).catch(() => undefined);
}
