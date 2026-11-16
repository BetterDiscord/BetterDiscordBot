import type {Attachment, Message} from "discord.js";
import {scamImageStatsDB} from "../db";
import type {ScamImageStats} from "../types";
import {readTextFromImage} from "./ocr";
import {matchScamTerms} from "./scamterms";


// Reading an image takes real CPU time, so a message can only spend so much of it
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 16_000_000;
const DOWNLOAD_TIMEOUT = 10 * 1000;

export interface FlaggedImage {
    name: string;
    contents: Buffer;

    /** The names of the scam terms found in the image */
    terms: string[];
}

export interface ImageScan {
    imagesScanned: number;

    /** The longest that any of the images waited for a free OCR worker (in milliseconds) */
    longestWait: number;

    /** The first image that matched the scam, if any did */
    flagged?: FlaggedImage;
}

function isReadableImage(attachment: Attachment): boolean {
    if (!attachment.contentType?.startsWith("image/")) return false;
    if (attachment.size > MAX_IMAGE_BYTES) return false;

    // Discord reports the dimensions of every image it could decode
    if (attachment.width && attachment.height && attachment.width * attachment.height > MAX_IMAGE_PIXELS) return false;
    return true;
}

async function download(attachment: Attachment): Promise<Buffer> {
    const response = await fetch(attachment.url, {signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT)});
    if (!response.ok) throw new Error(`Could not download ${attachment.name}: ${response.status}`);

    const contents = Buffer.from(await response.arrayBuffer());
    if (contents.byteLength > MAX_IMAGE_BYTES) throw new Error(`${attachment.name} is larger than Discord reported`);
    return contents;
}

/**
 * Reads the images attached to a message and looks for the crypto scam in their text.
 * It stops at the first image that matches, because one is enough to act on.
 * An image that cannot be downloaded or read is skipped.
 */
export async function scanImages(message: Message): Promise<ImageScan> {
    const images = [...message.attachments.values()].filter(isReadableImage).slice(0, MAX_IMAGES);
    const scan: ImageScan = {imagesScanned: 0, longestWait: 0};

    for (const image of images) {
        try {
            const contents = await download(image);
            const {text, waited} = await readTextFromImage(contents);
            scan.imagesScanned++;
            scan.longestWait = Math.max(scan.longestWait, waited);

            const match = matchScamTerms(text);
            if (!match.isScam) continue;

            scan.flagged = {name: image.name, contents, terms: match.terms};
            break;
        }
        catch (error) {
            console.error("Could not scan image for scam terms.", error);
        }
    }

    return scan;
}

export async function getScamImageStats(guildId: string): Promise<ScamImageStats> {
    return await scamImageStatsDB.get(guildId) ?? {imagesScanned: 0, messagesFlagged: 0, longestWait: 0};
}

// Scans of different messages finish at unpredictable times, so their updates to the stats run one after
// another. Otherwise two updates could read the same numbers and one would overwrite the other
let lastUpdate: Promise<unknown> = Promise.resolve();

/** Adds the result of one message's scan to the guild's running totals. */
export function recordScan(guildId: string, scan: ImageScan): Promise<void> {
    const update = lastUpdate.then(async () => {
        const stats = await getScamImageStats(guildId);
        stats.imagesScanned += scan.imagesScanned;
        stats.longestWait = Math.max(stats.longestWait, Math.round(scan.longestWait));
        if (scan.flagged) stats.messagesFlagged++;
        await scamImageStatsDB.set(guildId, stats);
    });

    lastUpdate = update.catch(() => {});
    return update;
}
