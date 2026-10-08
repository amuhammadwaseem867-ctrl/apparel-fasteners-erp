"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import "./Pagination.css";

export default function Pagination({
  page = 1,
  pageSize = 25,
  total = 0,

  onPageChange,
  onPageSizeChange,

  pageSizes = [25, 50, 100],

  showPageSize = true,
  showFirstLast = true,
  showSummary = true,

  siblingCount = 1,

  disabled = false,
  loading = false,

  className = "",
}) {
  const totalPages =
    total > 0
      ? Math.ceil(total / pageSize)
      : 1;

  const currentPage = Math.min(
    Math.max(page, 1),
    totalPages
  );

  const start =
    total === 0
      ? 0
      : (currentPage - 1) * pageSize + 1;

  const end =
    total === 0
      ? 0
      : Math.min(
          currentPage * pageSize,
          total
        );

  function goToPage(nextPage) {
    if (
      disabled ||
      loading ||
      nextPage < 1 ||
      nextPage > totalPages ||
      nextPage === currentPage
    ) {
      return;
    }

    onPageChange?.(nextPage);
  }

  function getPageNumbers() {
    const pages = [];

    if (totalPages <= 7) {
      for (
        let index = 1;
        index <= totalPages;
        index += 1
      ) {
        pages.push(index);
      }

      return pages;
    }

    const leftBoundary = Math.max(
      2,
      currentPage - siblingCount
    );

    const rightBoundary = Math.min(
      totalPages - 1,
      currentPage + siblingCount
    );

    pages.push(1);

    if (leftBoundary > 2) {
      pages.push("left-ellipsis");
    }

    for (
      let index = leftBoundary;
      index <= rightBoundary;
      index += 1
    ) {
      pages.push(index);
    }

    if (rightBoundary < totalPages - 1) {
      pages.push("right-ellipsis");
    }

    pages.push(totalPages);

    return pages;
  }

  const pageNumbers = getPageNumbers();

  const classes = [
    "erp-pagination",
    disabled || loading
      ? "erp-pagination--disabled"
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      {showSummary && (
        <div className="erp-pagination__summary">
          {total === 0 ? (
            <span>No records</span>
          ) : (
            <span>
              Showing{" "}
              <strong>{start}</strong>
              {" – "}
              <strong>{end}</strong>
              {" of "}
              <strong>{total}</strong>
            </span>
          )}
        </div>
      )}

      <div className="erp-pagination__controls">
        {showPageSize && (
          <div className="erp-pagination__page-size">
            <span className="erp-pagination__page-size-label">
              Rows
            </span>

            <select
              value={pageSize}
              disabled={disabled || loading}
              aria-label="Rows per page"
              onChange={(event) => {
                const nextSize =
                  Number(event.target.value);

                onPageSizeChange?.(nextSize);

                if (currentPage !== 1) {
                  onPageChange?.(1);
                }
              }}
            >
              {pageSizes.map((size) => (
                <option
                  key={size}
                  value={size}
                >
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}

        <div
          className="erp-pagination__buttons"
          role="navigation"
          aria-label="Pagination"
        >
          {showFirstLast && (
            <PaginationButton
              label="First page"
              disabled={
                disabled ||
                loading ||
                currentPage === 1
              }
              onClick={() => goToPage(1)}
            >
              <ChevronsLeft size={15} />
            </PaginationButton>
          )}

          <PaginationButton
            label="Previous page"
            disabled={
              disabled ||
              loading ||
              currentPage === 1
            }
            onClick={() =>
              goToPage(currentPage - 1)
            }
          >
            <ChevronLeft size={15} />
          </PaginationButton>

          {pageNumbers.map((item) => {
            if (
              item === "left-ellipsis" ||
              item === "right-ellipsis"
            ) {
              return (
                <span
                  key={item}
                  className="erp-pagination__ellipsis"
                >
                  …
                </span>
              );
            }

            const active =
              item === currentPage;

            return (
              <button
                key={item}
                type="button"
                className={[
                  "erp-pagination__page",
                  active
                    ? "erp-pagination__page--active"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={`Page ${item}`}
                aria-current={
                  active ? "page" : undefined
                }
                disabled={
                  disabled ||
                  loading
                }
                onClick={() =>
                  goToPage(item)
                }
              >
                {item}
              </button>
            );
          })}

          <PaginationButton
            label="Next page"
            disabled={
              disabled ||
              loading ||
              currentPage === totalPages
            }
            onClick={() =>
              goToPage(currentPage + 1)
            }
          >
            <ChevronRight size={15} />
          </PaginationButton>

          {showFirstLast && (
            <PaginationButton
              label="Last page"
              disabled={
                disabled ||
                loading ||
                currentPage === totalPages
              }
              onClick={() =>
                goToPage(totalPages)
              }
            >
              <ChevronsRight size={15} />
            </PaginationButton>
          )}
        </div>
      </div>
    </div>
  );
}

function PaginationButton({
  children,
  label,
  disabled,
  onClick,
}) {
  return (
    <button
      type="button"
      className="erp-pagination__button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}