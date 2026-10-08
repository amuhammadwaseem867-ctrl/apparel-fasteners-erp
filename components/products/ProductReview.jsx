"use client";

import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

import "./ProductReview.css";

const DIVISION_LABELS = {
  garments: "Garments",
  fabrics: "Fabrics",
  accessories: "Garment Accessories",
};

function displayValue(value, fallback = "Not specified") {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  return String(value);
}

function formatLabel(value) {
  if (!value) return "Not specified";

  return String(value)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function SummaryRow({
  label,
  value,
}) {
  return (
    <div className="product-review-row">
      <span>{label}</span>
      <strong>{displayValue(value)}</strong>
    </div>
  );
}

function SectionHeader({
  number,
  title,
  description,
}) {
  return (
    <div className="product-review-section-header">
      <div className="product-review-section-number">
        {number}
      </div>

      <div>
        <h3>{title}</h3>

        {description && (
          <p>{description}</p>
        )}
      </div>
    </div>
  );
}

export default function ProductReview({
  form = {},
  specifications = {},
  variants = [],
  inventory = {},
  pricing = {},
}) {
  const activeVariants = variants.filter(
    (variant) => variant.status !== "inactive"
  );

  return (
    <div className="product-review">
      <Card
        title="Review Product"
        description="Review all product information before creating the product record."
      >
        <div className="product-review-intro">
          <div>
            <span className="product-review-intro__label">
              Product
            </span>

            <h2>
              {displayValue(
                form.name,
                "Untitled Product"
              )}
            </h2>

            <p>
              {displayValue(
                form.sku,
                "No SKU assigned"
              )}
            </p>
          </div>

          <Badge variant="info">
            {DIVISION_LABELS[form.division] ||
              "Division Not Selected"}
          </Badge>
        </div>
      </Card>

      <Card>
        <SectionHeader
          number="01"
          title="Basic Information"
          description="Core product identification and commercial information."
        />

        <div className="product-review-grid">
          <SummaryRow
            label="Product Name"
            value={form.name}
          />

          <SummaryRow
            label="SKU / Product Code"
            value={form.sku}
          />

          <SummaryRow
            label="Brand"
            value={form.brand}
          />

          <SummaryRow
            label="Unit"
            value={form.unit}
          />

          <SummaryRow
            label="Description"
            value={form.description}
          />
        </div>
      </Card>

      <Card>
        <SectionHeader
          number="02"
          title="Category"
          description="Product division and classification."
        />

        <div className="product-review-grid">
          <SummaryRow
            label="Division"
            value={
              DIVISION_LABELS[form.division]
            }
          />

          <SummaryRow
            label="Subcategory"
            value={
              form.subcategory
                ? formatLabel(form.subcategory)
                : ""
            }
          />
        </div>
      </Card>

      <Card>
        <SectionHeader
          number="03"
          title="Specifications"
          description="Technical characteristics configured for this product."
        />

        {Object.keys(specifications).length === 0 ? (
          <div className="product-review-empty">
            No specifications have been configured.
          </div>
        ) : (
          <div className="product-review-grid">
            {Object.entries(specifications).map(
              ([key, value]) => (
                <SummaryRow
                  key={key}
                  label={formatLabel(key)}
                  value={value}
                />
              )
            )}
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader
          number="04"
          title="Variants"
          description={`${variants.length} variant${
            variants.length === 1 ? "" : "s"
          } configured.`}
        />

        {variants.length === 0 ? (
          <div className="product-review-empty">
            No product variants have been configured.
          </div>
        ) : (
          <div className="product-review-variants">
            {variants.map((variant, index) => (
              <div
                className="product-review-variant"
                key={variant.id || index}
              >
                <div className="product-review-variant__number">
                  {String(index + 1).padStart(2, "0")}
                </div>

                <div className="product-review-variant__content">
                  <div className="product-review-variant__top">
                    <strong>
                      {variant.sku ||
                        `Variant ${index + 1}`}
                    </strong>

                    <Badge
                      variant={
                        variant.status === "inactive"
                          ? "neutral"
                          : "success"
                      }
                    >
                      {formatLabel(
                        variant.status || "active"
                      )}
                    </Badge>
                  </div>

                  <div className="product-review-variant__details">
                    {Object.entries(
                      variant.values || {}
                    ).map(([key, value]) => (
                      <span key={key}>
                        <b>{formatLabel(key)}:</b>{" "}
                        {displayValue(value)}
                      </span>
                    ))}

                    <span>
                      <b>Barcode:</b>{" "}
                      {displayValue(
                        variant.barcode
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader
          number="05"
          title="Inventory"
          description="Stock control, warehouse and tracking configuration."
        />

        <div className="product-review-grid">
          <SummaryRow
            label="Inventory Status"
            value={formatLabel(
              inventory.stockStatus
            )}
          />

          <SummaryRow
            label="Stock Unit"
            value={formatLabel(
              inventory.stockUnit
            )}
          />

          <SummaryRow
            label="Opening Stock"
            value={inventory.openingStock}
          />

          <SummaryRow
            label="Minimum Stock"
            value={inventory.minimumStock}
          />

          <SummaryRow
            label="Reorder Level"
            value={inventory.reorderLevel}
          />

          <SummaryRow
            label="Safety Stock"
            value={inventory.safetyStock}
          />

          <SummaryRow
            label="Warehouse"
            value={inventory.warehouse}
          />

          <SummaryRow
            label="Storage Location"
            value={inventory.storageLocation}
          />

          <SummaryRow
            label="Bin / Rack"
            value={inventory.binRack}
          />

          <SummaryRow
            label="Tracking Method"
            value={formatLabel(
              inventory.trackingMethod
            )}
          />

          <SummaryRow
            label="Batch Tracking"
            value={
              inventory.batchTracking
                ? "Enabled"
                : "Disabled"
            }
          />

          <SummaryRow
            label="Serial Tracking"
            value={
              inventory.serialTracking
                ? "Enabled"
                : "Disabled"
            }
          />
        </div>
      </Card>

      <Card>
        <SectionHeader
          number="06"
          title="Pricing"
          description="Commercial pricing and tax configuration."
        />

        <div className="product-review-grid">
          <SummaryRow
            label="Currency"
            value={pricing.currency}
          />

          <SummaryRow
            label="Pricing Unit"
            value={formatLabel(
              pricing.pricingUnit
            )}
          />

          <SummaryRow
            label="Purchase Cost"
            value={pricing.purchaseCost}
          />

          <SummaryRow
            label="Standard Cost"
            value={pricing.standardCost}
          />

          <SummaryRow
            label="Selling Price"
            value={pricing.sellingPrice}
          />

          <SummaryRow
            label="Wholesale Price"
            value={pricing.wholesalePrice}
          />

          <SummaryRow
            label="Supplier Price"
            value={pricing.supplierPrice}
          />

          <SummaryRow
            label="Target Margin"
            value={
              pricing.targetMargin
                ? `${pricing.targetMargin}%`
                : ""
            }
          />

          <SummaryRow
            label="Tax Treatment"
            value={formatLabel(
              pricing.taxTreatment
            )}
          />

          <SummaryRow
            label="Tax Pricing"
            value={formatLabel(
              pricing.taxPricing
            )}
          />

          <SummaryRow
            label="Tax Rate"
            value={
              pricing.taxRate
                ? `${pricing.taxRate}%`
                : ""
            }
          />
        </div>
      </Card>

      <div className="product-review-ready">
        <div className="product-review-ready__indicator">
          ✓
        </div>

        <div>
          <strong>Ready to create product</strong>
          <p>
            Review the information above. Once created,
            this product can be used across sales,
            procurement, inventory, production and
            finance workflows.
          </p>
        </div>
      </div>
    </div>
  );
}