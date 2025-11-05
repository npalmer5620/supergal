import fs from "node:fs";
import path from "node:path";

export const uploadDir = () => path.resolve(process.env.UPLOAD_DIR || "./uploads");
export const originalDir = () => path.join(uploadDir(), "original");
export const thumbnail200Dir = () => path.join(uploadDir(), "thumbnails-200");
export const thumbnail500Dir = () => path.join(uploadDir(), "thumbnails-500");
export const thumbnail1000Dir = () => path.join(uploadDir(), "thumbnails-1000");

export const THUMBNAIL_SIZES = [
    { size: 200, dir: thumbnail200Dir, name: "thumbnails-200" },
    { size: 500, dir: thumbnail500Dir, name: "thumbnails-500" },
    { size: 1000, dir: thumbnail1000Dir, name: "thumbnails-1000" },
];

export function ensureDirs() {
    const dirs = [
        uploadDir(),
        originalDir(),
        thumbnail200Dir(),
        thumbnail500Dir(),
        thumbnail1000Dir(),
    ];
    dirs.forEach((p) => fs.mkdirSync(p, { recursive: true }));
}

export function getThumbnailPath(size, filename) {
    const thumbConfig = THUMBNAIL_SIZES.find((t) => t.size === size);
    if (!thumbConfig) throw new Error(`Unknown thumbnail size: ${size}`);
    return path.join(thumbConfig.dir(), filename);
}

export function getThumbnailUrl(size, filename) {
    const thumbConfig = THUMBNAIL_SIZES.find((t) => t.size === size);
    if (!thumbConfig) throw new Error(`Unknown thumbnail size: ${size}`);
    return `/uploads/${thumbConfig.name}/${filename}`;
}

export function fileUrlIfExists(relativePath) {
    const absolutePath = path.join(uploadDir(), relativePath);
    return fs.existsSync(absolutePath) ? `/uploads/${relativePath}` : undefined;
}

export function resolveImageUrls(filePath) {
    if (!filePath) {
        return {
            filename: null,
            urls: {
                original: undefined,
                thumbnail200: undefined,
                thumbnail500: undefined,
                thumbnail1000: undefined,
            },
        };
    }

    const filename = path.basename(filePath);
    return {
        filename,
        urls: {
            original: fileUrlIfExists(filePath),
            thumbnail200: fileUrlIfExists(`thumbnails-200/${filename}`),
            thumbnail500: fileUrlIfExists(`thumbnails-500/${filename}`),
            thumbnail1000: fileUrlIfExists(`thumbnails-1000/${filename}`),
        },
    };
}
