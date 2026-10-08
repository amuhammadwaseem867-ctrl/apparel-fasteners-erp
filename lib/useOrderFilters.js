"use client";

import { useMemo } from "react";

/*
 * useOrderFilters — real filtering/sorting/pagination over
 * the order list. Every search field and filter option
 * actually filters the visible rows.
 */

export default function useOrderFilters(orders, filters, sort, pagination) {
  return useMemo(() => {
    const value = (filters?.search || "").trim().toLowerCase();

    let rows = orders.filter((order) => {
      if (filters?.status && filters.status !== "all" && order.status !== filters.status) {
        return false;
      }

      if (filters?.customer && !order.customerName
        ?.toLowerCase()
        .includes((filters.customer || "").toLowerCase())) {
        return false;
      }

      if (filters?.stage && filters.stage !== "all" && order.currentStage !== filters.stage) {
        return false;
      }

      if (filters?.priority && filters.priority !== "all" && order.productionPriority !== filters.priority) {
        return false;
      }

      if (filters?.product && !order.zipperType
        ?.toLowerCase()
        .includes((filters.product || "").toLowerCase())) {
        return false;
      }

      if (filters?.size && filters.size !== "all" && order.zipperSize !== filters.size) {
        return false;
      }

      if (filters?.material && filters.material !== "all" && order.material !== filters.material) {
        return false;
      }

      if (filters?.finish && !order.colorFinish
        ?.toLowerCase()
        .includes((filters.finish || "").toLowerCase())) {
        return false;
      }

      if (filters?.logo && filters.logo !== "all" && order.logoType !== filters.logo) {
        return false;
      }

      if (filters?.dateFrom && order.orderDate && order.orderDate < filters.dateFrom) {
        return false;
      }

      if (filters?.dateTo && order.orderDate && order.orderDate > filters.dateTo) {
        return false;
      }

      if (value) {
        const searchable = [
          order.orderNumber,
          order.customerName,
          order.customerCode,
          order.zipperType,
          order.zipperSize,
          order.material,
          order.colorFinish,
          order.logoType,
          order.status,
          order.currentStage,
          order.requiredQuantity,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(value)) {
          return false;
        }
      }

      return true;
    });

    /* ---- sort ---- */
    const sortKey = sort?.key || "updatedAt";
    const sortDir = sort?.direction || "desc";

    rows = [...rows].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";

      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }

      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();

      if (as < bs) return sortDir === "asc" ? -1 : 1;
      if (as > bs) return sortDir === "asc" ? 1 : -1;

      return 0;
    });

    /* ---- pagination ---- */
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 25;
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);

    const paged = rows.slice(
      (safePage - 1) * pageSize,
      safePage * pageSize
    );

    return {
      rows: paged,
      total,
      page: safePage,
      pageSize,
      totalPages,
    };
  }, [orders, filters, sort, pagination]);
}
