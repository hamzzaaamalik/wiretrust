import React from 'react';

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = [];
  const left = Math.max(2, current - 2);
  const right = Math.min(total - 1, current + 2);

  pages.push(1);
  if (left > 2) pages.push('...');
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push('...');
  if (total > 1) pages.push(total);

  return pages;
}

export default function Pagination({ page, totalPages, onPageChange, className = '' }) {
  if (totalPages <= 1) return null;

  const isFirst = page === 1;
  const isLast = page === totalPages;
  const pages = getPageNumbers(page, totalPages);

  const base = 'px-2 py-1 rounded text-xs transition-colors';
  const disabled = `${base} text-zinc-700 cursor-not-allowed`;
  const inactive = `${base} text-zinc-500 hover:text-zinc-300`;
  const active = `${base} bg-zinc-700 text-white`;

  return (
    <nav className={`flex items-center justify-center gap-1 text-sm ${className}`}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={isFirst}
        className={isFirst ? disabled : inactive}
      >
        &lt; Prev
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-1 text-zinc-600 text-xs">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={p === page ? active : inactive}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={isLast}
        className={isLast ? disabled : inactive}
      >
        Next &gt;
      </button>
    </nav>
  );
}
