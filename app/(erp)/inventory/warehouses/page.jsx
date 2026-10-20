import { redirect } from "next/navigation";

/*
 * Warehouses and shelves are not used (D-048): AF7 types each location by
 * hand where stock is received, issued or packed. Old links land on the
 * raw material stock.
 */
export default function WarehousesPage() {
  redirect("/inventory/raw-material");
}
