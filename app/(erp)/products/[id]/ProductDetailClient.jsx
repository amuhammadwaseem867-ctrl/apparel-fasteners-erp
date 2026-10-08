"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Edit3,
  FileText,
  Image as ImageIcon,
  Package,
  Boxes,
  DollarSign,
  ClipboardList,
  Activity,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

import "./ProductDetail.css";

/*
 * Product detail — fetched from the backend by product id.
 * No mock record: until the backend is connected the page
 * shows an empty state.
 */
const PRODUCT = null;

export default function ProductDetailClient({ id }) {
  const productId = id;

  if (!PRODUCT) {
    return (
      <div className="product-detail-page">
        <PageHeader
          title="Product"
          description="Product details load from the backend once connected."
          action={
            <Link href="/products">
              <Button variant="secondary" icon={ArrowLeft}>
                Products
              </Button>
            </Link>
          }
        />

        <div
          style={{
            padding: "60px 20px",
            textAlign: "center",
            color: "var(--af-text-muted)",
            fontSize: "12px",
            background: "var(--af-surface)",
            border: "1px solid var(--af-border)",
            borderRadius: "9px",
          }}
        >
          No product data available yet. Products will appear here
          once the product database is connected.
        </div>
      </div>
    );
  }

  return (
    <div className="product-detail-page">
      <PageHeader
        title={PRODUCT.name}
        description={`${PRODUCT.sku} · ${PRODUCT.division} · ${PRODUCT.category}`}
        action={
          <div className="product-detail-header-actions">
            <Link href="/products">
              <Button
                variant="secondary"
                icon={ArrowLeft}
              >
                Products
              </Button>
            </Link>

            <Link
              href={`/products/${productId}/edit`}
            >
              <Button icon={Edit3}>
                Edit Product
              </Button>
            </Link>
          </div>
        }
      />

      <div className="product-detail-hero">
        <div className="product-detail-hero__identity">
          <div className="product-detail-hero__icon">
            <Package size={24} />
          </div>

          <div>
            <div className="product-detail-hero__eyebrow">
              Product Master
            </div>

            <h2>{PRODUCT.name}</h2>

            <p>{PRODUCT.description}</p>

            <div className="product-detail-hero__meta">
              <span>{PRODUCT.sku}</span>
              <span>{PRODUCT.division}</span>
              <span>{PRODUCT.category}</span>
              <span>{PRODUCT.unit}</span>
            </div>
          </div>
        </div>

        <div className="product-detail-hero__status">
          <Badge variant="success">
            Active
          </Badge>
        </div>
      </div>

      <div className="product-detail-stats">
        <Stat
          label="Current Stock"
          value={PRODUCT.inventory.currentStock}
          icon={Boxes}
        />

        <Stat
          label="Selling Price"
          value={PRODUCT.pricing.sellingPrice}
          icon={DollarSign}
        />

        <Stat
          label="Variants"
          value={PRODUCT.variants.length}
          icon={ClipboardList}
        />

        <Stat
          label="Documents"
          value={PRODUCT.documents.length}
          icon={FileText}
        />
      </div>

      <div className="product-detail-grid">
        <div className="product-detail-main">
          <Card
            title="Overview"
            description="Core product master information."
          >
            <div className="product-detail-info-grid">
              <Info
                label="Product Name"
                value={PRODUCT.name}
              />
              <Info
                label="SKU / Product Code"
                value={PRODUCT.sku}
              />
              <Info
                label="Brand"
                value={PRODUCT.brand}
              />
              <Info
                label="Division"
                value={PRODUCT.division}
              />
              <Info
                label="Category"
                value={PRODUCT.category}
              />
              <Info
                label="Unit"
                value={PRODUCT.unit}
              />
              <Info
                label="Status"
                value="Active"
              />
            </div>
          </Card>

          <Card
            title="Specifications"
            description="Technical characteristics of the product."
          >
            <div className="product-detail-info-grid">
              {Object.entries(
                PRODUCT.specifications
              ).map(([key, value]) => (
                <Info
                  key={key}
                  label={formatLabel(key)}
                  value={value}
                />
              ))}
            </div>
          </Card>

          <Card
            title="Variants"
            description={`${PRODUCT.variants.length} configured product variants.`}
          >
            <div className="product-detail-table-wrapper">
              <table className="product-detail-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Size</th>
                    <th>Color</th>
                    <th>Barcode</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {PRODUCT.variants.map(
                    (variant) => (
                      <tr key={variant.sku}>
                        <td>
                          <strong>
                            {variant.sku}
                          </strong>
                        </td>
                        <td>{variant.size}</td>
                        <td>{variant.color}</td>
                        <td>
                          {variant.barcode}
                        </td>
                        <td>
                          <Badge variant="success">
                            Active
                          </Badge>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card
            title="Inventory"
            description="Stock control and warehouse configuration."
          >
            <div className="product-detail-info-grid">
              {Object.entries(
                PRODUCT.inventory
              ).map(([key, value]) => (
                <Info
                  key={key}
                  label={formatLabel(key)}
                  value={value}
                />
              ))}
            </div>
          </Card>

          <Card
            title="Pricing"
            description="Commercial pricing and tax configuration."
          >
            <div className="product-detail-info-grid">
              {Object.entries(
                PRODUCT.pricing
              ).map(([key, value]) => (
                <Info
                  key={key}
                  label={formatLabel(key)}
                  value={value}
                />
              ))}
            </div>
          </Card>

          <Card
            title="Documents"
            description="Technical and compliance documents attached to this product."
          >
            <div className="product-detail-documents">
              {PRODUCT.documents.map(
                (document) => (
                  <div
                    className="product-detail-document"
                    key={document.name}
                  >
                    <div className="product-detail-document__icon">
                      <FileText size={18} />
                    </div>

                    <div>
                      <strong>
                        {document.name}
                      </strong>
                      <span>
                        {document.type} ·{" "}
                        {document.size}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          </Card>
        </div>

        <aside className="product-detail-sidebar">
          <Card
            title="Product Image"
            description="Primary catalog image."
          >
            <div className="product-detail-image-placeholder">
              <ImageIcon size={24} />
              <span>
                Product image
              </span>
            </div>
          </Card>

          <Card
            title="Activity"
            description="Recent product changes."
          >
            <div className="product-detail-activity">
              {PRODUCT.activity.map(
                (item, index) => (
                  <div
                    className="product-detail-activity__item"
                    key={`${item.action}-${index}`}
                  >
                    <div className="product-detail-activity__marker">
                      <Activity size={13} />
                    </div>

                    <div>
                      <strong>
                        {item.action}
                      </strong>

                      <span>
                        {item.user}
                      </span>

                      <small>
                        {item.date}
                      </small>
                    </div>
                  </div>
                )
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}) {
  return (
    <div className="product-detail-stat">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>

      <div className="product-detail-stat__icon">
        <Icon size={17} />
      </div>
    </div>
  );
}

function Info({
  label,
  value,
}) {
  return (
    <div className="product-detail-info">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function formatLabel(value) {
  return String(value)
    .replace(/([A-Z])/g, " $1")
    .replace(/-/g, " ")
    .replace(/^./, (char) =>
      char.toUpperCase()
    );
}