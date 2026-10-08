"use client";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Switch from "@/components/ui/Switch";

import "./ProductInventory.css";

const TRACKING_OPTIONS = [
  {
    value: "none",
    label: "No Tracking",
  },
  {
    value: "batch",
    label: "Batch / Lot",
  },
  {
    value: "serial",
    label: "Serial Number",
  },
];

const STOCK_STATUS_OPTIONS = [
  {
    value: "stocked",
    label: "Stocked Product",
  },
  {
    value: "non-stocked",
    label: "Non-Stocked Product",
  },
];

const STORAGE_UNITS = [
  {
    value: "pcs",
    label: "Pieces",
  },
  {
    value: "kg",
    label: "Kilograms",
  },
  {
    value: "meter",
    label: "Meters",
  },
  {
    value: "yard",
    label: "Yards",
  },
  {
    value: "roll",
    label: "Rolls",
  },
  {
    value: "box",
    label: "Boxes",
  },
  {
    value: "carton",
    label: "Cartons",
  },
];

export default function ProductInventory({
  values = {},
  onChange,
}) {
  function updateField(name, value) {
    onChange?.(name, value);
  }

  return (
    <div className="product-inventory">
      <Card
        title="Inventory Settings"
        description="Configure stock control, storage and inventory tracking for this product."
      >
        <div className="product-inventory-section">
          <div className="product-inventory-section__header">
            <div>
              <h4>Stock Control</h4>
              <p>
                Define how this product is managed in inventory.
              </p>
            </div>
          </div>

          <div className="product-inventory-grid">
            <Select
              label="Inventory Status"
              placeholder="Select status"
              options={STOCK_STATUS_OPTIONS}
              value={values.stockStatus || "stocked"}
              onChange={(value) =>
                updateField("stockStatus", value)
              }
            />

            <Select
              label="Stock Unit"
              placeholder="Select unit"
              options={STORAGE_UNITS}
              value={values.stockUnit || ""}
              onChange={(value) =>
                updateField("stockUnit", value)
              }
            />

            <Input
              label="Opening Stock"
              type="number"
              min="0"
              placeholder="e.g. 1000"
              value={values.openingStock || ""}
              onChange={(event) =>
                updateField(
                  "openingStock",
                  event.target.value
                )
              }
            />

            <Input
              label="Minimum Stock"
              type="number"
              min="0"
              placeholder="e.g. 100"
              value={values.minimumStock || ""}
              onChange={(event) =>
                updateField(
                  "minimumStock",
                  event.target.value
                )
              }
            />

            <Input
              label="Reorder Level"
              type="number"
              min="0"
              placeholder="e.g. 250"
              value={values.reorderLevel || ""}
              onChange={(event) =>
                updateField(
                  "reorderLevel",
                  event.target.value
                )
              }
            />

            <Input
              label="Safety Stock"
              type="number"
              min="0"
              placeholder="e.g. 150"
              value={values.safetyStock || ""}
              onChange={(event) =>
                updateField(
                  "safetyStock",
                  event.target.value
                )
              }
            />
          </div>
        </div>
      </Card>

      <Card
        title="Warehouse & Storage"
        description="Define the default location where this product is stored."
      >
        <div className="product-inventory-section">
          <div className="product-inventory-grid">
            <Input
              label="Warehouse"
              placeholder="e.g. Main Warehouse"
              value={values.warehouse || ""}
              onChange={(event) =>
                updateField(
                  "warehouse",
                  event.target.value
                )
              }
            />

            <Input
              label="Storage Location"
              placeholder="e.g. A-01-03"
              value={values.storageLocation || ""}
              onChange={(event) =>
                updateField(
                  "storageLocation",
                  event.target.value
                )
              }
            />

            <Input
              label="Bin / Rack"
              placeholder="e.g. Rack A-03"
              value={values.binRack || ""}
              onChange={(event) =>
                updateField(
                  "binRack",
                  event.target.value
                )
              }
            />

            <Input
              label="Storage Notes"
              placeholder="e.g. Keep dry and protected"
              value={values.storageNotes || ""}
              onChange={(event) =>
                updateField(
                  "storageNotes",
                  event.target.value
                )
              }
            />
          </div>
        </div>
      </Card>

      <Card
        title="Tracking"
        description="Choose how stock movements and inventory units should be tracked."
      >
        <div className="product-inventory-section">
          <div className="product-inventory-grid">
            <Select
              label="Tracking Method"
              placeholder="Select tracking method"
              options={TRACKING_OPTIONS}
              value={values.trackingMethod || "none"}
              onChange={(value) =>
                updateField(
                  "trackingMethod",
                  value
                )
              }
            />

            <Input
              label="Shelf Life"
              type="number"
              min="0"
              placeholder="e.g. 365"
              value={values.shelfLife || ""}
              onChange={(event) =>
                updateField(
                  "shelfLife",
                  event.target.value
                )
              }
            />

            <Select
              label="Shelf Life Unit"
              options={[
                {
                  value: "days",
                  label: "Days",
                },
                {
                  value: "months",
                  label: "Months",
                },
              ]}
              value={values.shelfLifeUnit || "days"}
              onChange={(value) =>
                updateField(
                  "shelfLifeUnit",
                  value
                )
              }
            />
          </div>

          <div className="product-inventory-toggles">
            <div className="product-inventory-toggle">
              <div>
                <strong>Batch / Lot Tracking</strong>
                <span>
                  Track stock by production or receiving batch.
                </span>
              </div>

              <Switch
                checked={Boolean(values.batchTracking)}
                onChange={(checked) =>
                  updateField(
                    "batchTracking",
                    checked
                  )
                }
              />
            </div>

            <div className="product-inventory-toggle">
              <div>
                <strong>Serial Tracking</strong>
                <span>
                  Assign a unique serial number to each unit.
                </span>
              </div>

              <Switch
                checked={Boolean(values.serialTracking)}
                onChange={(checked) =>
                  updateField(
                    "serialTracking",
                    checked
                  )
                }
              />
            </div>

            <div className="product-inventory-toggle">
              <div>
                <strong>Expiry Tracking</strong>
                <span>
                  Track expiry dates for applicable products.
                </span>
              </div>

              <Switch
                checked={Boolean(values.expiryTracking)}
                onChange={(checked) =>
                  updateField(
                    "expiryTracking",
                    checked
                  )
                }
              />
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="Inventory Notes"
        description="Add internal instructions for warehouse and inventory teams."
      >
        <Input
          label="Notes"
          placeholder="Enter inventory handling instructions..."
          value={values.inventoryNotes || ""}
          onChange={(event) =>
            updateField(
              "inventoryNotes",
              event.target.value
            )
          }
        />
      </Card>
    </div>
  );
}