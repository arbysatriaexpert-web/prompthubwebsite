/**
 * Pagination.jsx — PromptHub v5.5
 *
 * Pager sederhana untuk halaman Tools. Menampilkan maksimal 5 nomor di
 * sekitar halaman aktif supaya tetap muat di layar HP.
 *
 * Gaya diambil dari kelas .ph-pager* di ToolsPage.css.
 */

function buildPages(current, total, window = 2) {
  const pages = [];
  const start = Math.max(1, current - window);
  const end = Math.min(total, current + window);

  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('gap-start');
  }
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total) {
    if (end < total - 1) pages.push('gap-end');
    pages.push(total);
  }
  return pages;
}

export default function Pagination({
  page,
  totalPages,
  onChange,
  disabled = false,
  totalItems,
  pageSize,
}) {
  if (!totalPages || totalPages <= 1) return null;

  const pages = buildPages(page, totalPages);
  const from = totalItems ? (page - 1) * pageSize + 1 : null;
  const to = totalItems ? Math.min(page * pageSize, totalItems) : null;

  function go(n) {
    if (disabled) return;
    const next = Math.min(totalPages, Math.max(1, n));
    if (next === page) return;
    onChange(next);
  }

  return (
    <nav className="ph-pager" aria-label="Navigasi halaman">
      {totalItems ? (
        <div className="ph-pager-info">
          Menampilkan {from}–{to} dari {totalItems}
        </div>
      ) : null}

      <div className="ph-pager-row">
        <button
          type="button"
          className="ph-pager-btn"
          onClick={() => go(page - 1)}
          disabled={disabled || page <= 1}
          aria-label="Halaman sebelumnya"
        >
          ‹
        </button>

        {pages.map((p) =>
          typeof p === 'number' ? (
            <button
              key={p}
              type="button"
              className={`ph-pager-btn ${p === page ? 'is-active' : ''}`}
              onClick={() => go(p)}
              disabled={disabled}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ) : (
            <span key={p} className="ph-pager-gap">…</span>
          ),
        )}

        <button
          type="button"
          className="ph-pager-btn"
          onClick={() => go(page + 1)}
          disabled={disabled || page >= totalPages}
          aria-label="Halaman berikutnya"
        >
          ›
        </button>
      </div>
    </nav>
  );
}
