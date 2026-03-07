#!/usr/bin/env tsx

import * as fs from "fs";
import * as path from "path";

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY;
const ORSHOT_API_KEY = process.env.ORSHOT_API_KEY;

const ROOT = path.join(__dirname, "..");
const TWEETS_FILE = path.join(ROOT, "tweets.json");
const OUTPUT_DIR = path.join(ROOT, "public", "tweets");

interface TweetEntry {
  url: string;
  tweetId: string;
  author: {
    name: string;
    handle: string;
    avatarUrl: string;
    isVerified: boolean;
    followers: number;
  };
  text: string;
  metrics: {
    views: number;
    likes: number;
    retweets: number;
    replies: number;
    bookmarks: number;
  };
  createdAt: string;
}

function extractTweetId(url: string): string {
  const match = url.match(/status\/(\d+)/);
  if (!match) throw new Error(`Cannot extract tweet ID from: ${url}`);
  return match[1];
}

async function fetchTweetData(tweetUrl: string): Promise<TweetEntry> {
  if (!SCRAPECREATORS_API_KEY) {
    throw new Error("SCRAPECREATORS_API_KEY environment variable is not set");
  }

  const response = await fetch(
    `https://api.scrapecreators.com/v1/twitter/tweet?url=${encodeURIComponent(tweetUrl)}`,
    {
      method: "GET",
      headers: { "x-api-key": SCRAPECREATORS_API_KEY },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ScrapeCreators API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const userResult = data?.core?.user_results?.result || {};
  const userCore = userResult?.core || {};
  const userLegacy = userResult?.legacy || {};
  const tweetLegacy = data?.legacy || {};
  const tweetId = data?.rest_id || extractTweetId(tweetUrl);

  return {
    url: tweetUrl,
    tweetId,
    author: {
      name: userCore.name || userLegacy.name || "",
      handle: userCore.screen_name || userLegacy.screen_name || "",
      avatarUrl: userResult?.avatar?.image_url || userLegacy.profile_image_url_https || "",
      isVerified: userResult?.is_blue_verified || false,
      followers: userLegacy.followers_count || 0,
    },
    text: tweetLegacy.full_text || "",
    metrics: {
      views: parseInt(data?.views?.count || "0", 10),
      likes: tweetLegacy.favorite_count || 0,
      retweets: tweetLegacy.retweet_count || 0,
      replies: tweetLegacy.reply_count || 0,
      bookmarks: tweetLegacy.bookmark_count || 0,
    },
    createdAt: tweetLegacy.created_at || "",
  };
}

async function generateScreenshot(tweetUrl: string, tweetId: string): Promise<string> {
  if (!ORSHOT_API_KEY) {
    throw new Error("ORSHOT_API_KEY environment variable is not set");
  }

  const filePath = path.join(OUTPUT_DIR, `${tweetId}.png`);

  if (fs.existsSync(filePath)) {
    console.error(`Screenshot already exists for ${tweetId}`);
    return filePath;
  }

  console.error(`Generating screenshot for ${tweetId}...`);

  const response = await fetch("https://api.orshot.com/v1/generate/images", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ORSHOT_API_KEY}`,
    },
    body: JSON.stringify({
      templateId: "tweet-image",
      response: { format: "png", type: "base64", scale: 1 },
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
    throw new Error(`Orshot API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const base64Data = data?.data?.content || data?.image || data?.base64;

  if (!base64Data || typeof base64Data !== "string") {
    throw new Error(`No image data. Keys: ${JSON.stringify(Object.keys(data))}`);
  }

  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(filePath, buffer);
  console.error(`Saved screenshot: ${filePath}`);
  return filePath;
}

async function main() {
  const urls = process.argv.slice(2);

  if (urls.length === 0) {
    console.error("Usage: add-tweet.ts <tweet_url> [tweet_url2] ...");
    process.exit(1);
  }

  const existing: TweetEntry[] = JSON.parse(fs.readFileSync(TWEETS_FILE, "utf-8"));
  const existingIds = new Set(existing.map((t) => t.tweetId));
  const added: TweetEntry[] = [];

  for (const url of urls) {
    const tweetId = extractTweetId(url);

    if (existingIds.has(tweetId)) {
      console.error(`Skipping ${tweetId} (already in tweets.json)`);
      continue;
    }

    try {
      console.error(`\nProcessing: ${url}`);
      const entry = await fetchTweetData(url);
      await generateScreenshot(url, entry.tweetId);
      added.push(entry);
      existingIds.add(entry.tweetId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`FAILED: ${tweetId} - ${msg}`);
    }
  }

  if (added.length > 0) {
    const updated = [...added, ...existing];
    fs.writeFileSync(TWEETS_FILE, JSON.stringify(updated, null, 2) + "\n");
    console.error(`\nAdded ${added.length} tweet(s) to tweets.json`);
  }

  // Output the added entries as JSON to stdout
  console.log(JSON.stringify(added, null, 2));
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
