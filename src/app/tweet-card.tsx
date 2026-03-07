"use client";

import { useState } from "react";

export function TweetCard({ filename, url, alt }: { filename: string; url: string; alt: string }) {
  const [showOverlay, setShowOverlay] = useState(false);

  return (
    <div
      className="masonry-item"
      onClick={() => setShowOverlay(!showOverlay)}
    >
      <img
        src={`/tweets/${filename}`}
        alt={alt}
        loading="lazy"
      />
      {showOverlay && (
        <div className="tweet-overlay" onClick={(e) => e.stopPropagation()}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="view-on-x"
          >
            View on X
          </a>
          <button
            className="overlay-close"
            onClick={(e) => {
              e.stopPropagation();
              setShowOverlay(false);
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
