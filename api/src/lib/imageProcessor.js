import sharp from "sharp";
import fs from "node:fs";
import { THUMBNAIL_SIZES, getThumbnailPath, getThumbnailUrl } from "./files.js";

/**
 * Detect image dimensions
 * @param {string} filePath - Path to image file
 * @returns {Promise<{width: number, height: number}>}
 */
export async function detectDimensions(filePath) {
    try {
        const metadata = await sharp(filePath).metadata();
        return {
            width: metadata.width,
            height: metadata.height,
        };
    } catch (error) {
        throw new Error(`Failed to detect image dimensions: ${error.message}`);
    }
}

/**
 * Generate thumbnails for an image
 * @param {string} filePath - Path to original image file
 * @param {string} filename - Filename for thumbnails (without extension)
 * @returns {Promise<Object>} - Object with thumbnail URLs and paths
 */
export async function generateThumbnails(filePath, filename) {
    try {
        const results = {
            paths: {},
            urls: {},
        };

        // Read the original image
        const image = sharp(filePath);
        const metadata = await image.metadata();

        // Generate each thumbnail size
        for (const thumbConfig of THUMBNAIL_SIZES) {
            const { size, name } = thumbConfig;
            const thumbPath = getThumbnailPath(size, filename);

            // Resize image: fit within size x size, preserve aspect ratio
            await image
                .resize(size, size, {
                    fit: "contain",
                    background: { r: 255, g: 255, b: 255, alpha: 1 }, // white background
                })
                .toFile(thumbPath);

            results.paths[size] = thumbPath;
            results.urls[size] = getThumbnailUrl(size, filename);
        }

        return results;
    } catch (error) {
        // Clean up any partially created thumbnails
        for (const thumbConfig of THUMBNAIL_SIZES) {
            const thumbPath = getThumbnailPath(thumbConfig.size, filename);
            try {
                fs.unlinkSync(thumbPath);
            } catch (e) {
                // ignore
            }
        }
        throw new Error(`Failed to generate thumbnails: ${error.message}`);
    }
}

/**
 * Process uploaded image: detect dimensions, generate thumbnails, return metadata
 * @param {string} filePath - Path to uploaded image file
 * @param {string} filename - Filename (used for thumbnails)
 * @returns {Promise<Object>} - Image metadata and thumbnail URLs
 */
export async function processImage(filePath, filename) {
    try {
        // Detect dimensions
        const { width, height } = await detectDimensions(filePath);

        // Generate thumbnails
        const thumbnails = await generateThumbnails(filePath, filename);

        return {
            width,
            height,
            thumbnails: {
                small: thumbnails.urls[200],
                medium: thumbnails.urls[500],
                large: thumbnails.urls[1000],
            },
            thumbnail_urls: thumbnails.urls,
        };
    } catch (error) {
        throw error;
    }
}

/**
 * Delete all thumbnails for an image
 * @param {string} filename - Filename to delete
 */
export async function deleteThumbnails(filename) {
    for (const thumbConfig of THUMBNAIL_SIZES) {
        const thumbPath = getThumbnailPath(thumbConfig.size, filename);
        try {
            fs.unlinkSync(thumbPath);
        } catch (e) {
            // File might not exist, ignore
        }
    }
}
