"use client";

import Button from "@/components/ui/Button";

/* Page navigation for APIs that return { page, hasMore }. */
export default function InventoryPager({ page, hasMore, onChange, disabled }) {
  if (page === 1 && !hasMore) {
    return null;
  }

  return (
    <nav className="inv-pager" aria-label="Pagination">
      <Button variant="secondary" size="small" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </Button>
      <span>Page {page}</span>
      <Button variant="secondary" size="small" disabled={disabled || !hasMore} onClick={() => onChange(page + 1)}>
        Next
      </Button>
    </nav>
  );
}
