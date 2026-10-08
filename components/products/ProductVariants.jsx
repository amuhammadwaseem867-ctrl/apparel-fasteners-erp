"use client";

import { Plus, Trash2, Copy } from "lucide-react";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";

import "./ProductVariants.css";

const DIVISION_OPTIONS = {
  garments: [
    {
      key: "size",
      label: "Size",
      placeholder: "e.g. S, M, L, XL",
    },
    {
      key: "color",
      label: "Color",
      placeholder: "e.g. Navy, Black",
    },
  ],

  fabrics: [
    {
      key: "color",
      label: "Color",
      placeholder: "e.g. Navy, White",
    },
    {
      key: "width",
      label: "Width",
      placeholder: "e.g. 58 inch",
    },
  ],

  accessories: [
    {
      key: "size",
      label: "Size",
      placeholder: "e.g. 5 mm",
    },
    {
      key: "color",
      label: "Color",
      placeholder: "e.g. Black",
    },
    {
      key: "finish",
      label: "Finish",
      placeholder: "e.g. Antique",
    },
  ],
};

function createVariantId() {
  return `variant-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export default function ProductVariants({
  division,
  variants = [],
  onChange,
}) {
  const attributes =
    DIVISION_OPTIONS[division] || [];

  function addVariant() {
    const values = {};

    attributes.forEach((attribute) => {
      values[attribute.key] = "";
    });

    onChange([
      ...variants,
      {
        id: createVariantId(),
        sku: "",
        barcode: "",
        status: "active",
        values,
      },
    ]);
  }

  function updateVariant(
    variantId,
    field,
    value
  ) {
    onChange(
      variants.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              [field]: value,
            }
          : variant
      )
    );
  }

  function updateAttribute(
    variantId,
    attribute,
    value
  ) {
    onChange(
      variants.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              values: {
                ...variant.values,
                [attribute]: value,
              },
            }
          : variant
      )
    );
  }

  function duplicateVariant(variant) {
    onChange([
      ...variants,
      {
        ...variant,
        id: createVariantId(),
        sku: variant.sku
          ? `${variant.sku}-COPY`
          : "",
        barcode: "",
        values: {
          ...variant.values,
        },
      },
    ]);
  }

  function removeVariant(variantId) {
    onChange(
      variants.filter(
        (variant) =>
          variant.id !== variantId
      )
    );
  }

  const activeCount = variants.filter(
    (variant) =>
      variant.status === "active"
  ).length;

  const skuCount = variants.filter(
    (variant) =>
      variant.sku?.trim()
  ).length;

  if (!division) {
    return (
      <Card
        title="Product Variants"
        description="Select a product division before configuring variants."
      >
        <div className="product-variants-empty">
          Select a division in the Category
          step to configure variants.
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Product Variants"
      description={`Configure ${attributes
        .map((item) => item.label)
        .join(" + ")} combinations for this product.`}
      action={
        <Button
          size="small"
          icon={Plus}
          onClick={addVariant}
        >
          Add Variant
        </Button>
      }
    >
      <div className="product-variants-summary">
        <div>
          <span>Total Variants</span>
          <strong>{variants.length}</strong>
        </div>

        <div>
          <span>Active</span>
          <strong>{activeCount}</strong>
        </div>

        <div>
          <span>SKU Assigned</span>
          <strong>{skuCount}</strong>
        </div>
      </div>

      {variants.length === 0 ? (
        <div className="product-variants-empty">
          <div>
            <strong>
              No variants created
            </strong>

            <p>
              Add variants for different
              sizes, colors, widths or finishes.
            </p>

            <Button
              icon={Plus}
              onClick={addVariant}
            >
              Add First Variant
            </Button>
          </div>
        </div>
      ) : (
        <div className="product-variants-list">
          {variants.map(
            (variant, index) => (
              <VariantRow
                key={variant.id}
                variant={variant}
                index={index}
                attributes={attributes}
                onUpdate={updateVariant}
                onUpdateAttribute={
                  updateAttribute
                }
                onDuplicate={
                  duplicateVariant
                }
                onRemove={removeVariant}
              />
            )
          )}
        </div>
      )}
    </Card>
  );
}

function VariantRow({
  variant,
  index,
  attributes,
  onUpdate,
  onUpdateAttribute,
  onDuplicate,
  onRemove,
}) {
  return (
    <div className="product-variant-row">
      <div className="product-variant-number">
        {String(index + 1).padStart(
          2,
          "0"
        )}
      </div>

      <div className="product-variant-fields">
        {attributes.map((attribute) => (
          <Input
            key={attribute.key}
            label={attribute.label}
            placeholder={
              attribute.placeholder
            }
            value={
              variant.values?.[
                attribute.key
              ] || ""
            }
            onChange={(event) =>
              onUpdateAttribute(
                variant.id,
                attribute.key,
                event.target.value
              )
            }
          />
        ))}

        <Input
          label="Variant SKU"
          placeholder="e.g. GAR-DNM-001-M-NAV"
          value={variant.sku}
          onChange={(event) =>
            onUpdate(
              variant.id,
              "sku",
              event.target.value
            )
          }
        />

        <Input
          label="Barcode"
          placeholder="Enter barcode"
          value={variant.barcode}
          onChange={(event) =>
            onUpdate(
              variant.id,
              "barcode",
              event.target.value
            )
          }
        />

        <Select
          label="Status"
          options={[
            {
              value: "active",
              label: "Active",
            },
            {
              value: "inactive",
              label: "Inactive",
            },
          ]}
          value={variant.status}
          onChange={(value) =>
            onUpdate(
              variant.id,
              "status",
              value
            )
          }
        />
      </div>

      <div className="product-variant-actions">
        <button
          type="button"
          title="Duplicate variant"
          aria-label="Duplicate variant"
          onClick={() =>
            onDuplicate(variant)
          }
        >
          <Copy size={15} />
        </button>

        <button
          type="button"
          title="Delete variant"
          aria-label="Delete variant"
          onClick={() =>
            onRemove(variant.id)
          }
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}