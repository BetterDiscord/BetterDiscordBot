import {expect, test} from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {readTextFromImage} from "../src/util/ocr";
import {matchScamTerms} from "../src/util/scamterms";


// A generated image in the style of the scam (not a real one), shrunk and saved as a low-quality JPEG
const generatedScam = fs.readFileSync(path.join(import.meta.dir, "fixtures", "fake-scam.jpg"));

test("reads the text in an image", async () => {
    const {text} = await readTextFromImage(generatedScam);
    expect(text).toContain("MrBeast Casino");
    expect(text).toContain("2,500.00 USDT");
    expect(matchScamTerms(text).isScam).toBe(true);
}, 30_000);

test("images sent at the same time are all read", async () => {
    const results = await Promise.all([readTextFromImage(generatedScam), readTextFromImage(generatedScam), readTextFromImage(generatedScam)]);
    expect(results.map(r => r.text.includes("Withdraw success"))).toEqual([true, true, true]);
}, 30_000);

test("a file that is not an image rejects, and the next image is still read", async () => {
    expect(readTextFromImage(Buffer.from("this is not an image"))).rejects.toThrow();

    const {text} = await readTextFromImage(generatedScam);
    expect(text).toContain("MrBeast Casino");
}, 30_000);
