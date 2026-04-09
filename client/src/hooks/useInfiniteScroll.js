import { useEffect, useRef } from 'react';

const useInfiniteScroll = (onLoadMore, hasMore) => {
  const containerRef = useRef(null);
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { root: containerRef.current, threshold: 0.1 }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore]);

  return { containerRef, sentinelRef };
};

export default useInfiniteScroll;
