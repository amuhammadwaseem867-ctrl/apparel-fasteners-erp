"use client";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

import "./ProductBasicInfo.css";

export default function ProductBasicInfo({
  values = {},
  onChange,
}) {
  function updateField(name, value) {
    onChange?.(name, value);
  }

  return (
    <div className="product-basic-info">
      <Card
        title="Basic Information"
        description="Enter the core identification and commercial details for this product."
      >
        <div className="product-basic-info__grid">
          <Input
            label="Product Name"
            required
            placeholder="e.g. Premium Denim Jacket"
            value={values.name || ""}
            onChange={(event) =>
              updateField(
                "name",
                event.target.value
              )
            }
          />

          <Input
            label="SKU / Product Code"
            required
            placeholder="e.g. GAR-DNM-001"
            value={values.sku || ""}
            onChange={(event) =>
              updateField(
                "sku",
                event.target.value
              )
            }
          />

          <Input
            label="Brand"
            placeholder="e.g. AF Apparel"
            value={values.brand || ""}
            onChange={(event) =>
              updateField(
                "brand",
                event.target.value
              )
            }
          />

          <Input
            label="Unit"
            required
            placeholder="e.g. Piece, Meter, KG"
            value={values.unit || ""}
            onChange={(event) =>
              updateField(
                "unit",
                event.target.value
              )
            }
          />

          <Input
            label="Barcode"
            placeholder="Enter barcode"
            value={values.barcode || ""}
            onChange={(event) =>
              updateField(
                "barcode",
                event.target.value
              )
            }
          />

          <Input
            label="Internal Reference"
            placeholder="e.g. REF-2026-001"
            value={values.internalReference || ""}
            onChange={(event) =>
              updateField(
                "internalReference",
                event.target.value
              )
            }
          />
        </div>

        <div className="product-basic-info__description">
          <Input
            label="Description"
            placeholder="Enter a clear description of the product..."
            value={values.description || ""}
            onChange={(event) =>
              updateField(
                "description",
                event.target.value
              )
            }
          />
        </div>
      </Card>

      <Card
        title="Product Status"
        description="Define the initial status of the product master record."
      >
        <div className="product-basic-info__status">
          <button
            type="button"
            className={`product-basic-info__status-option ${
              (values.status || "active") === "active"
                ? "is-active"
                : ""
            }`}
            onClick={() =>
              updateField("status", "active")
            }
          >
            <span className="product-basic-info__status-dot" />

            <span>
              <strong>Active</strong>
              <small>
                Product can be used in sales, purchasing,
                inventory and production.
              </small>
            </span>
          </button>

          <button
            type="button"
            className={`product-basic-info__status-option ${
              values.status === "draft"
                ? "is-active"
                : ""
            }`}
            onClick={() =>
              updateField("status", "draft")
            }
          >
            <span className="product-basic-info__status-dot" />

            <span>
              <strong>Draft</strong>
              <small>
                Product remains in draft until it is ready
                for operational use.
              </small>
            </span>
          </button>

          <button
            type="button"
            className={`product-basic-info__status-option ${
              values.status === "inactive"
                ? "is-active"
                : ""
            }`}
            onClick={() =>
              updateField("status", "inactive")
            }
          >
            <span className="product-basic-info__status-dot" />

            <span>
              <strong>Inactive</strong>
              <small>
                Product is retained but unavailable for
                new operational transactions.
              </small>
            </span>
          </button>
        </div>
      </Card>
    </div>
  );
}