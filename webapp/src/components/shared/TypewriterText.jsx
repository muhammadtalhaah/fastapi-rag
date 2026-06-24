import { useEffect, useState } from "react";

const TypewriterText = ({ text = "", speed = 35, className = "", onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const displayedText = text.slice(0, currentIndex);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = window.setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
      }, speed);

      return () => window.clearTimeout(timeout);
    }

    if (text) {
      onComplete?.();
    }
    return undefined;
  }, [currentIndex, onComplete, speed, text]);

  return (
    <span className={className}>
      {displayedText}
      {currentIndex < text.length ? (
        <span className="ml-0.5 inline-block h-3 w-px animate-pulse bg-current align-middle" />
      ) : null}
    </span>
  );
};

export default TypewriterText;