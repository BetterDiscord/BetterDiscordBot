import path from "node:path";
import {createRequire} from "node:module";
import Tesseract, {createWorker, type Worker} from "tesseract.js";
import {WorkerPool} from "./workerpool";


// Each worker adds roughly 85-130 MB of memory, more workers only help when several messages with images arrive at once
const WORKER_COUNT = 1;
const OCR_TIMEOUT = 30 * 1000;

// The language data ships in an npm package, so nothing is downloaded when a worker starts.
// This folder holds the data for the LSTM engine, which is the one the worker is started with.
const require = createRequire(import.meta.url);
const languageDataPath = path.join(path.dirname(require.resolve("@tesseract.js-data/eng")), "4.0.0_best_int");

const pool = new WorkerPool<Worker>({
    size: WORKER_COUNT,
    start: () => createWorker("eng", Tesseract.OEM.LSTM_ONLY, {
        langPath: languageDataPath,
        cacheMethod: "none",
        // Without a handler, tesseract.js throws worker errors where nothing can catch them
        errorHandler: (error: unknown) => console.error("OCR worker error:", error),
    }),
    stop: worker => worker.terminate(),
});

export interface OcrResult {
    /** The text in the image, with every run of whitespace and line breaks collapsed to one space */
    text: string;
    /** How long the image waited for a free worker (in milliseconds) */
    waited: number;
}

/**
 * Reads the text in an image.
 * Rejects if the image cannot be decoded, or with a `JobTimeoutError` if reading it takes too long.
 */
export async function readTextFromImage(image: Buffer): Promise<OcrResult> {
    const {result, waited} = await pool.run(worker => worker.recognize(image), OCR_TIMEOUT);
    return {text: result.data.text.replace(/\s+/g, " ").trim(), waited};
}
