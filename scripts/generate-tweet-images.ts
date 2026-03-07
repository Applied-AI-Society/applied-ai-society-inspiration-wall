#!/usr/bin/env tsx

import * as fs from "fs";
import * as path from "path";

const ORSHOT_API_KEY = process.env.ORSHOT_API_KEY;
const TWEETS_FILE = path.join(__dirname, "..", "tweets.json");
const OUTPUT_DIR = path.join(__dirname, "..", "public", "tweets");

function extractTweetId(url: string): string {
  const match = url.match(/status\/(\d+)/);
  if (!match) throw new Error(`Cannot extract tweet ID from: ${url}`);
  return match[1];
}

async function generateScreenshot(tweetUrl: string): Promise<string> {
  if (!ORSHOT_API_KEY) {
    throw new Error("ORSHOT_API_KEY environment variable is not set");
  }

  const tweetId = extractTweetId(tweetUrl);
  const filePath = path.join(OUTPUT_DIR, `${tweetId}.png`);

  if (fs.existsSync(filePath)) {
    console.log(`Skipping ${tweetId} (already exists)`);
    return filePath;
  }

  console.log(`Generating screenshot for ${tweetId}...`);

  const response = await fetch("https://api.orshot.com/v1/generate/images", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ORSHOT_API_KEY}`,
    },
    body: JSON.stringify({
      templateId: "tweet-image",
      response: {
        format: "png",
        type: "base64",
        scale: 1,
      },
      modifications: {
        tweetUrl,
        tweetFontSize: 2,
        tweetBackgroundColor: "#fff",
        tweetTextColor: "#111",
        showRepliedToTweet: false,
        hideHeader: false,
        hideMetrics: true,
        googleFont: "Inter",
        hideVerifiedIcon: false,
        hideQuoteTweet: false,
        hideDateTime: true,
        hideMedia: false,
        hideShadow: true,
        backgroundColor: "#ffffff",
        backgroundImageUrl: "",
        padding: 0,
        hidePadding: true,
        width: 800,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Orshot API error for ${tweetId}: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const base64Data = data?.data?.content || data?.image || data?.base64;

  if (!base64Data || typeof base64Data !== "string") {
    throw new Error(`No image data for ${tweetId}. Keys: ${JSON.stringify(Object.keys(data))}`);
  }

  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(filePath, buffer);
  console.log(`Saved: ${filePath}`);
  return filePath;
}

async function main() {
  const tweets: string[] = JSON.parse(fs.readFileSync(TWEETS_FILE, "utf-8"));
  console.log(`Generating ${tweets.length} tweet screenshots...\n`);

  const results: { url: string; id: string; success: boolean; error?: string }[] = [];

  for (const url of tweets) {
    const id = extractTweetId(url);
    try {
      await generateScreenshot(url);
      results.push({ url, id, success: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`FAILED: ${id} - ${msg}`);
      results.push({ url, id, success: false, error: msg });
    }
  }

  console.log("\n--- Results ---");
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`${succeeded} succeeded, ${failed} failed`);

  if (failed > 0) {
    console.log("\nFailed tweets:");
    results.filter((r) => !r.success).forEach((r) => console.log(`  ${r.id}: ${r.error}`));
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
