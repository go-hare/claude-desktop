import { useMemo } from 'react';
import { BOOK_COMPARISONS } from './utils';

export default function TokenComparison({ totalTokens }: { totalTokens: number }) {
  const book = useMemo(() => {
    const eligible = BOOK_COMPARISONS.filter((item) => totalTokens >= item.tokens);
    return eligible.length ? eligible[Math.floor(Math.random() * eligible.length)] : null;
  }, [totalTokens]);

  if (!book) return null;
  const times = Math.floor(totalTokens / book.tokens);

  return (
    <span className="text-caption text-t6 pt-[4px]">
      {times >= 2
        ? `You've used ~${times}× more tokens than ${book.name}.`
        : `You've used about as many tokens as ${book.name}.`}
    </span>
  );
}
