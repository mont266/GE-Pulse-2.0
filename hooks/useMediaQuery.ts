import { useState, useEffect } from 'react';

// A custom hook to determine if the viewport matches a given CSS media query.
// This allows components to adapt their layout and behavior based on screen size,
// such as rendering mobile-optimized charts.
export const useMediaQuery = (query: string): boolean => {
  const getMatches = (query: string): boolean => {
    // Prevents SSR issues by checking for `window`
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  };

  const [matches, setMatches] = useState<boolean>(getMatches(query));

  useEffect(() => {
    const matchMedia = window.matchMedia(query);

    // Handles changes to the media query match status.
    const handleChange = () => {
      setMatches(getMatches(query));
    };
    
    // Listen for changes (e.g., screen rotation, window resize).
    // Using `addEventListener` is the modern and recommended approach.
    matchMedia.addEventListener('change', handleChange);

    // Cleanup by removing the listener when the component unmounts.
    return () => {
      matchMedia.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
};
