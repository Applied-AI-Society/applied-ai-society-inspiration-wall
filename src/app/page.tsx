import fs from "fs";
import path from "path";
import { TweetCard } from "./tweet-card";

interface TweetImage {
  filename: string;
  url: string;
}

function getTweetImages(): TweetImage[] {
  const tweetsDir = path.join(process.cwd(), "public", "tweets");
  if (!fs.existsSync(tweetsDir)) return [];

  const tweetsJson = path.join(process.cwd(), "tweets.json");
  if (fs.existsSync(tweetsJson)) {
    const urls: string[] = JSON.parse(fs.readFileSync(tweetsJson, "utf-8"));
    return urls
      .map((url) => {
        const match = url.match(/status\/(\d+)/);
        if (!match) return null;
        const filename = `${match[1]}.png`;
        if (!fs.existsSync(path.join(tweetsDir, filename))) return null;
        return { filename, url };
      })
      .filter((t): t is TweetImage => t !== null);
  }

  return fs
    .readdirSync(tweetsDir)
    .filter((f) => f.endsWith(".png"))
    .sort()
    .map((filename) => ({ filename, url: "" }));
}

export default function Home() {
  const tweets = getTweetImages();

  return (
    <>
      <div className="header">
        <img
          src="https://docs.appliedaisociety.org/img/logo.svg"
          alt="Applied AI Society"
        />
        <h1>Inspiration Wall</h1>
      </div>
      <main className="masonry">
        {tweets.map(({ filename, url }) => (
          <TweetCard key={filename} filename={filename} url={url} />
        ))}
      </main>
    </>
  );
}
