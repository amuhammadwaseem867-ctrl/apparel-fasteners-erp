"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";

import "./Table.css";

export default function Table({
  columns = [],
  data = [],

  rowKey = "id",

  selectable = false,
  selectedRows = [],
  onSelectionChange,

  sortable = false,
  sortBy,
  sortDirection = "asc",
  onSort,

  loading = false,
  loadingRows = 6,

  emptyTitle = "No records found",
  emptyDescription = "There are no records to display.",

  rowActions,

  stickyHeader = false,
  compact = false,

  pagination = false,
  page = 1,
  pageSize = 25,
  total = 0,
  onPageChange,

  className = "",
}) {
  const [internalSort, setInternalSort] =
    useState({
      key: sortBy || "",
      direction: sortDirection,
    });

  const activeSortKey =
    sortBy ?? internalSort.key;

  const activeSortDirection =
    sortBy
      ? sortDirection
      : internalSort.direction;

  const visibleRows = useMemo(() => {
    if (sortable && !onSort && activeSortKey) {
      return [...data].sort(
        (a, b) => {
          const aValue =
            a[activeSortKey];
          const bValue =
            b[activeSortKey];

          if (
            aValue === bValue
          ) {
            return 0;
          }

          if (
            aValue === undefined ||
            aValue === null
          ) {
            return 1;
          }

          if (
            bValue === undefined ||
            bValue === null
          ) {
            return -1;
          }

          const result =
            String(aValue).localeCompare(
              String(bValue),
              undefined,
              {
                numeric: true,
                sensitivity: "base",
              }
            );

          return activeSortDirection ===
            "asc"
            ? result
            : -result;
        }
      );
    }

    return data;
  }, [
    data,
    sortable,
    onSort,
    activeSortKey,
    activeSortDirection,
  ]);

  const allVisibleSelected =
    visibleRows.length > 0 &&
    visibleRows.every((row) =>
      selectedRows.includes(
        getRowKey(row)
      )
    );

  const someVisibleSelected =
    visibleRows.some((row) =>
      selectedRows.includes(
        getRowKey(row)
      )
    );

  function getRowKey(row) {
    if (typeof rowKey === "function") {
      return rowKey(row);
    }

    return row[rowKey];
  }

  function handleSort(column) {
    if (
      !sortable ||
      column.sortable === false
    ) {
      return;
    }

    const key =
      column.sortKey ||
      column.key;

    if (!key) return;

    const nextDirection =
      activeSortKey === key &&
      activeSortDirection === "asc"
        ? "desc"
        : "asc";

    if (onSort) {
      onSort({
        key,
        direction: nextDirection,
      });
      return;
    }

    setInternalSort({
      key,
      direction: nextDirection,
    });
  }

  function handleSelectAll() {
    if (!onSelectionChange) return;

    const visibleKeys =
      visibleRows.map(getRowKey);

    if (allVisibleSelected) {
      onSelectionChange(
        selectedRows.filter(
          (key) =>
            !visibleKeys.includes(key)
        )
      );
    } else {
      onSelectionChange([
        ...new Set([
          ...selectedRows,
          ...visibleKeys,
        ]),
      ]);
    }
  }

  function handleSelectRow(row) {
    if (!onSelectionChange) return;

    const key = getRowKey(row);

    if (selectedRows.includes(key)) {
      onSelectionChange(
        selectedRows.filter(
          (item) => item !== key
        )
      );
    } else {
      onSelectionChange([
        ...selectedRows,
        key,
      ]);
    }
  }

  const classes = [
    "erp-table-wrapper",
    compact
      ? "erp-table-wrapper--compact"
      : "",
    stickyHeader
      ? "erp-table-wrapper--sticky"
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const colSpan =
    columns.length +
    (selectable ? 1 : 0) +
    (rowActions ? 1 : 0);

  return (
    <div className={classes}>
      <table className="erp-table">
        <thead>
          <tr>
            {selectable && (
              <th className="erp-table__select-column">
                <button
                  type="button"
                  className={`erp-table__checkbox ${
                    allVisibleSelected
                      ? "erp-table__checkbox--checked"
                      : someVisibleSelected
                        ? "erp-table__checkbox--indeterminate"
                        : ""
                  }`}
                  onClick={
                    handleSelectAll
                  }
                  aria-label={
                    allVisibleSelected
                      ? "Deselect all"
                      : "Select all"
                  }
                >
                  {allVisibleSelected && (
                    <Check size={13} />
                  )}

                  {!allVisibleSelected &&
                    someVisibleSelected && (
                      <span />
                    )}
                </button>
              </th>
            )}

            {columns.map(
              (column) => {
                const key =
                  column.sortKey ||
                  column.key;

                const isSortable =
                  sortable &&
                  column.sortable !==
                    false;

                const isActive =
                  activeSortKey ===
                  key;

                return (
                  <th
                    key={key}
                    className={[
                      column.headerClassName ||
                        "",
                      column.align
                        ? `erp-table__align--${column.align}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{
                      width:
                        column.width,
                      minWidth:
                        column.minWidth,
                    }}
                  >
                    {isSortable ? (
                      <button
                        type="button"
                        className={`erp-table__sort ${
                          isActive
                            ? "erp-table__sort--active"
                            : ""
                        }`}
                        onClick={() =>
                          handleSort(
                            column
                          )
                        }
                      >
                        <span>
                          {
                            column.label
                          }
                        </span>

                        {!isActive && (
                          <ArrowUpDown
                            size={13}
                          />
                        )}

                        {isActive &&
                          activeSortDirection ===
                            "asc" && (
                            <ArrowUp
                              size={13}
                            />
                          )}

                        {isActive &&
                          activeSortDirection ===
                            "desc" && (
                            <ArrowDown
                              size={13}
                            />
                          )}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              }
            )}

            {rowActions && (
              <th className="erp-table__actions-column">
                Actions
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            Array.from({
              length: loadingRows,
            }).map((_, index) => (
              <SkeletonRow
                key={`skeleton-${index}`}
                columns={columns}
                selectable={selectable}
                rowActions={Boolean(
                  rowActions
                )}
              />
            ))
          ) : visibleRows.length === 0 ? (
            <tr>
              <td
                colSpan={colSpan}
                className="erp-table__empty-cell"
              >
                <div className="erp-table__empty">
                  <div className="erp-table__empty-icon">
                    <span />
                  </div>

                  <div className="erp-table__empty-title">
                    {emptyTitle}
                  </div>

                  <div className="erp-table__empty-description">
                    {emptyDescription}
                  </div>
                </div>
              </td>
            </tr>
          ) : (
            visibleRows.map(
              (row, rowIndex) => {
                const key =
                  getRowKey(row);

                const selected =
                  selectedRows.includes(
                    key
                  );

                return (
                  <tr
                    key={key ?? rowIndex}
                    className={
                      selected
                        ? "erp-table__row--selected"
                        : ""
                    }
                  >
                    {selectable && (
                      <td className="erp-table__select-column">
                        <button
                          type="button"
                          className={`erp-table__checkbox ${
                            selected
                              ? "erp-table__checkbox--checked"
                              : ""
                          }`}
                          onClick={() =>
                            handleSelectRow(
                              row
                            )
                          }
                          aria-label={
                            selected
                              ? "Deselect row"
                              : "Select row"
                          }
                        >
                          {selected && (
                            <Check
                              size={13}
                            />
                          )}
                        </button>
                      </td>
                    )}

                    {columns.map(
                      (column) => {
                        const cellValue =
                          getNestedValue(
                            row,
                            column.key
                          );

                        return (
                          <td
                            key={
                              column.key
                            }
                            className={[
                              column.cellClassName ||
                                "",
                              column.align
                                ? `erp-table__align--${column.align}`
                                : "",
                            ]
                              .filter(
                                Boolean
                              )
                              .join(
                                " "
                              )}
                          >
                            {column.render
                              ? column.render(
                                  cellValue,
                                  row,
                                  rowIndex
                                )
                              : cellValue ??
                                "—"}
                          </td>
                        );
                      }
                    )}

                    {rowActions && (
                      <td className="erp-table__actions-cell">
                        {typeof rowActions ===
                        "function"
                          ? rowActions(
                              row
                            )
                          : rowActions}
                      </td>
                    )}
                  </tr>
                );
              }
            )
          )}
        </tbody>
      </table>

      {pagination && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={
            onPageChange
          }
        />
      )}
    </div>
  );
}

/* =========================================
   SKELETON ROW
========================================= */

function SkeletonRow({
  columns,
  selectable,
  rowActions,
}) {
  return (
    <tr className="erp-table__skeleton-row">
      {selectable && (
        <td>
          <span className="erp-table__skeleton erp-table__skeleton--checkbox" />
        </td>
      )}

      {columns.map((column) => (
        <td key={column.key}>
          <span
            className="erp-table__skeleton"
            style={{
              width:
                column.skeletonWidth ||
                "72%",
            }}
          />
        </td>
      ))}

      {rowActions && (
        <td>
          <span className="erp-table__skeleton erp-table__skeleton--action" />
        </td>
      )}
    </tr>
  );
}

/* =========================================
   PAGINATION
========================================= */

function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
}) {
  const totalPages = Math.max(
    1,
    Math.ceil(total / pageSize)
  );

  const start =
    total === 0
      ? 0
      : (page - 1) * pageSize + 1;

  const end = Math.min(
    page * pageSize,
    total
  );

  return (
    <div className="erp-table-pagination">
      <div className="erp-table-pagination__info">
        Showing{" "}
        <strong>{start}</strong>
        {"–"}
        <strong>{end}</strong>
        {" of "}
        <strong>{total}</strong>
      </div>

      <div className="erp-table-pagination__controls">
        <button
          type="button"
          className="erp-table-pagination__button"
          disabled={page <= 1}
          onClick={() =>
            onPageChange?.(page - 1)
          }
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>

        <span className="erp-table-pagination__page">
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          className="erp-table-pagination__button"
          disabled={page >= totalPages}
          onClick={() =>
            onPageChange?.(page + 1)
          }
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

/* =========================================
   NESTED VALUE
========================================= */

function getNestedValue(object, path) {
  if (!path) return undefined;

  return path
    .split(".")
    .reduce(
      (current, key) =>
        current?.[key],
      object
    );
}