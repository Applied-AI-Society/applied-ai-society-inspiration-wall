import fs from "fs";
import path from "path";
import { TweetCard } from "./tweet-card";

interface TweetEntry {
  url: string;
  tweetId: string;
  author: {
    name: string;
    handle: string;
  };
  text: string;
}

interface TweetImage {
  filename: string;
  url: string;
  alt: string;
}

function getTweetImages(): TweetImage[] {
  const tweetsDir = path.join(process.cwd(), "public", "tweets");
  if (!fs.existsSync(tweetsDir)) return [];

  const tweetsJson = path.join(process.cwd(), "tweets.json");
  if (!fs.existsSync(tweetsJson)) return [];

  const entries: TweetEntry[] = JSON.parse(fs.readFileSync(tweetsJson, "utf-8"));
  return entries
    .map((entry) => {
      const filename = `${entry.tweetId}.png`;
      if (!fs.existsSync(path.join(tweetsDir, filename))) return null;
      const alt = entry.author?.name
        ? `Tweet by ${entry.author.name} (@${entry.author.handle}): ${entry.text?.slice(0, 120) || ""}`
        : "Tweet";
      return { filename, url: entry.url, alt };
    })
    .filter((t): t is TweetImage => t !== null);
}

export default function Home() {
  const tweets = getTweetImages();

  return (
    <>
      <div className="header">
        <a href="https://appliedaisociety.org" target="_blank" rel="noopener noreferrer">
          <img
            src="https://docs.appliedaisociety.org/img/logo.svg"
            alt="Applied AI Society"
          />
        </a>
        <h1>Inspiration Wall</h1>
      </div>
      <main className="masonry">
        {tweets.map(({ filename, url, alt }) => (
          <TweetCard key={filename} filename={filename} url={url} alt={alt} />
        ))}
      </main>
    </>
  );
}
