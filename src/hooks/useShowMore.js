import { useState, useMemo } from "react";

/**
 * Generic show-more / show-less toggle.
 * Menggantikan pola useState(showAll) + .slice() yang terduplikasi di beberapa page.
 *
 * @param {Array} items — daftar item
 * @param {number} [threshold=7] — jumlah awal yang ditampilkan
 * @returns {{ showAll: boolean, toggle: () => void, visibleItems: Array }}
 */
export function useShowMore(items = [], threshold = 10) {
  const [showAll, setShowAll] = useState(false);

  const visibleItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    return showAll ? items : items.slice(0, threshold);
  }, [items, showAll, threshold]);

  const toggle = () => setShowAll((prev) => !prev);

  return { showAll, toggle, visibleItems };
}
