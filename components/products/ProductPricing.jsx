"use client";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

import "./ProductPricing.css";

const CURRENCY_OPTIONS = [
  {
    value: "PKR",
    label: "PKR — Pakistani Rupee",
  },
  {
    value: "USD",
    label: "USD — US Dollar",
  },
  {
    value: "EUR",
    label: "EUR — Euro",
  },
  {
    value: "GBP",
    label: "GBP — British Pound",
  },
  {
    value: "CNY",
    label: "CNY — Chinese Yuan",
  },
  {
    value: "HKD",
    label: "HKD — Hong Kong Dollar",
  },
];

const PRICING_UNITS = [
  {
    value: "pcs",
    label: "Per Piece",
  },
  {
    value: "kg",
    label: "Per Kilogram",
  },
  {
    value: "meter",
    label: "Per Meter",
  },
  {
    value: "yard",
    label: "Per Yard",
  },
  {
    value: "roll",
    label: "Per Roll",
  },
  {
    value: "box",
    label: "Per Box",
  },
];

const TAX_TREATMENT_OPTIONS = [
  {
    value: "taxable",
    label: "Taxable",
  },
  {
    value: "zero-rated",
    label: "Zero Rated",
  },
  {
    value: "exempt",
    label: "Tax Exempt",
  },
  {
    value: "non-taxable",
    label: "Non-Taxable",
  },
];

const TAX_INCLUSION_OPTIONS = [
  {
    value: "exclusive",
    label: "Tax Exclusive",
  },
  {
    value: "inclusive",
    label: "Tax Inclusive",
  },
];

export default function ProductPricing({
  values = {},
  onChange,
}) {
  function updateField(name, value) {
    onChange?.(name, value);
  }

  return (
    <div className="product-pricing">
      <Card
        title="Pricing Settings"
        description="Define the base pricing and commercial values for this product."
      >
        <div className="product-pricing-grid">
          <Select
            label="Currency"
            placeholder="Select currency"
            options={CURRENCY_OPTIONS}
            value={values.currency || "PKR"}
            onChange={(value) =>
              updateField("currency", value)
            }
          />

          <Select
            label="Pricing Unit"
            placeholder="Select pricing unit"
            options={PRICING_UNITS}
            value={values.pricingUnit || ""}
            onChange={(value) =>
              updateField("pricingUnit", value)
            }
          />

          <Input
            label="Purchase Cost"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 850"
            value={values.purchaseCost || ""}
            onChange={(event) =>
              updateField(
                "purchaseCost",
                event.target.value
              )
            }
          />

          <Input
            label="Standard Cost"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 900"
            value={values.standardCost || ""}
            onChange={(event) =>
              updateField(
                "standardCost",
                event.target.value
              )
            }
          />

          <Input
            label="Selling Price"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 1250"
            value={values.sellingPrice || ""}
            onChange={(event) =>
              updateField(
                "sellingPrice",
                event.target.value
              )
            }
          />

          <Input
            label="Wholesale Price"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 1100"
            value={values.wholesalePrice || ""}
            onChange={(event) =>
              updateField(
                "wholesalePrice",
                event.target.value
              )
            }
          />
        </div>
      </Card>

      <Card
        title="Supplier Pricing"
        description="Store the default commercial terms used when purchasing this product."
      >
        <div className="product-pricing-grid">
          <Input
            label="Supplier Price"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 800"
            value={values.supplierPrice || ""}
            onChange={(event) =>
              updateField(
                "supplierPrice",
                event.target.value
              )
            }
          />

          <Input
            label="Minimum Purchase Price"
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 750"
            value={values.minimumPurchasePrice || ""}
            onChange={(event) =>
              updateField(
                "minimumPurchasePrice",
                event.target.value
              )
            }
          />

          <Input
            label="Supplier Lead Time"
            type="number"
            min="0"
            placeholder="e.g. 15"
            value={values.supplierLeadTime || ""}
            onChange={(event) =>
              updateField(
                "supplierLeadTime",
                event.target.value
              )
            }
          />

          <Select
            label="Lead Time Unit"
            options={[
              {
                value: "days",
                label: "Days",
              },
              {
                value: "weeks",
                label: "Weeks",
              },
            ]}
            value={values.supplierLeadTimeUnit || "days"}
            onChange={(value) =>
              updateField(
                "supplierLeadTimeUnit",
                value
              )
            }
          />
        </div>
      </Card>

      <Card
        title="Margin"
        description="Define the target margin used for commercial pricing."
      >
        <div className="product-pricing-grid">
          <Input
            label="Target Margin"
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="e.g. 25"
            suffix="%"
            value={values.targetMargin || ""}
            onChange={(event) =>
              updateField(
                "targetMargin",
                event.target.value
              )
            }
          />

          <Input
            label="Minimum Margin"
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="e.g. 15"
            suffix="%"
            value={values.minimumMargin || ""}
            onChange={(event) =>
              updateField(
                "minimumMargin",
                event.target.value
              )
            }
          />

          <Input
            label="Discount Limit"
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="e.g. 10"
            suffix="%"
            value={values.discountLimit || ""}
            onChange={(event) =>
              updateField(
                "discountLimit",
                event.target.value
              )
            }
          />
        </div>
      </Card>

      <Card
        title="Tax Treatment"
        description="Configure the default tax treatment for this product."
      >
        <div className="product-pricing-grid">
          <Select
            label="Tax Treatment"
            placeholder="Select treatment"
            options={TAX_TREATMENT_OPTIONS}
            value={values.taxTreatment || "taxable"}
            onChange={(value) =>
              updateField(
                "taxTreatment",
                value
              )
            }
          />

          <Select
            label="Tax Pricing"
            placeholder="Select pricing"
            options={TAX_INCLUSION_OPTIONS}
            value={values.taxPricing || "exclusive"}
            onChange={(value) =>
              updateField(
                "taxPricing",
                value
              )
            }
          />

          <Input
            label="Default Tax Rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="e.g. 18"
            suffix="%"
            value={values.taxRate || ""}
            onChange={(event) =>
              updateField(
                "taxRate",
                event.target.value
              )
            }
          />
        </div>

        <div className="product-pricing-note">
          <strong>Tax configuration</strong>
          <span>
            Product tax settings can later be overridden by
            applicable customer, supplier, exemption and
            effective-date tax rules.
          </span>
        </div>
      </Card>

      <Card
        title="Pricing Notes"
        description="Add internal commercial instructions or pricing remarks."
      >
        <Input
          label="Notes"
          placeholder="Enter pricing notes..."
          value={values.pricingNotes || ""}
          onChange={(event) =>
            updateField(
              "pricingNotes",
              event.target.value
            )
          }
        />
      </Card>
    </div>
  );
}