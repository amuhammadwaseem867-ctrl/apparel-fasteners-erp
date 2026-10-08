"use client";

import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Card from "@/components/ui/Card";

import "./ProductSpecifications.css";

const GARMENT_FIELDS = [
  {
    name: "material",
    label: "Material",
    placeholder: "e.g. Denim, Leather, Cotton",
  },
  {
    name: "composition",
    label: "Composition",
    placeholder: "e.g. 100% Cotton",
  },
  {
    name: "sizeRange",
    label: "Size Range",
    placeholder: "e.g. S - XXL",
  },
  {
    name: "color",
    label: "Color",
    placeholder: "e.g. Dark Blue",
  },
];

const FABRIC_FIELDS = [
  {
    name: "fabricType",
    label: "Fabric Type",
    placeholder: "e.g. Woven, Knit",
  },
  {
    name: "composition",
    label: "Composition",
    placeholder: "e.g. 100% Cotton",
  },
  {
    name: "gsm",
    label: "GSM",
    placeholder: "e.g. 180",
    type: "number",
  },
  {
    name: "width",
    label: "Width",
    placeholder: "e.g. 58 inch",
  },
  {
    name: "construction",
    label: "Construction",
    placeholder: "e.g. Plain Weave",
  },
  {
    name: "finish",
    label: "Finish",
    placeholder: "e.g. Soft Finish",
  },
  {
    name: "color",
    label: "Color",
    placeholder: "e.g. Navy",
  },
  {
    name: "fiber",
    label: "Fiber",
    placeholder: "e.g. Organic Cotton",
  },
];

const ACCESSORY_FIELDS = [
  {
    name: "material",
    label: "Material",
    placeholder: "e.g. Brass, Nylon",
  },
  {
    name: "size",
    label: "Size",
    placeholder: "e.g. 5 mm",
  },
  {
    name: "finish",
    label: "Finish",
    placeholder: "e.g. Antique",
  },
  {
    name: "color",
    label: "Color",
    placeholder: "e.g. Black",
  },
  {
    name: "length",
    label: "Length",
    placeholder: "e.g. 60 cm",
  },
  {
    name: "width",
    label: "Width",
    placeholder: "e.g. 20 mm",
  },
];

const SEASON_OPTIONS = [
  {
    value: "spring-summer",
    label: "Spring / Summer",
  },
  {
    value: "autumn-winter",
    label: "Autumn / Winter",
  },
  {
    value: "all-season",
    label: "All Season",
  },
];

const GENDER_OPTIONS = [
  {
    value: "men",
    label: "Men",
  },
  {
    value: "women",
    label: "Women",
  },
  {
    value: "unisex",
    label: "Unisex",
  },
  {
    value: "kids",
    label: "Kids",
  },
];

const FIBER_TYPE_OPTIONS = [
  {
    value: "natural",
    label: "Natural",
  },
  {
    value: "synthetic",
    label: "Synthetic",
  },
  {
    value: "recycled",
    label: "Recycled",
  },
  {
    value: "blended",
    label: "Blended",
  },
];

export default function ProductSpecifications({
  division,
  values = {},
  onChange,
}) {
  function updateField(name, value) {
    onChange?.(name, value);
  }

  if (!division) {
    return (
      <Card
        title="Specifications"
        description="Select a product division to configure technical specifications."
      >
        <div className="product-specifications-empty">
          <strong>No division selected</strong>
          <p>
            Select Garments, Fabrics or Garment Accessories
            in the Category step.
          </p>
        </div>
      </Card>
    );
  }

  const isGarment = division === "garments";
  const isFabric = division === "fabrics";
  const isAccessory = division === "accessories";

  const fields = isGarment
    ? GARMENT_FIELDS
    : isFabric
      ? FABRIC_FIELDS
      : ACCESSORY_FIELDS;

  const title = isGarment
    ? "Garment Specifications"
    : isFabric
      ? "Fabric Specifications"
      : "Accessory Specifications";

  const description = isGarment
    ? "Define the technical characteristics and product details of the garment."
    : isFabric
      ? "Define the technical characteristics and construction details of the fabric."
      : "Define the technical characteristics and application details of the accessory.";

  return (
    <Card
      title={title}
      description={description}
    >
      <div className="product-specifications">
        <div className="product-specifications-grid">
          {fields.map((field) => (
            <Input
              key={field.name}
              label={field.label}
              placeholder={field.placeholder}
              type={field.type || "text"}
              value={values[field.name] || ""}
              onChange={(event) =>
                updateField(
                  field.name,
                  event.target.value
                )
              }
            />
          ))}

          {isGarment && (
            <>
              <Select
                label="Season"
                placeholder="Select season"
                options={SEASON_OPTIONS}
                value={values.season || ""}
                onChange={(value) =>
                  updateField("season", value)
                }
              />

              <Select
                label="Gender"
                placeholder="Select gender"
                options={GENDER_OPTIONS}
                value={values.gender || ""}
                onChange={(value) =>
                  updateField("gender", value)
                }
              />

              <Input
                label="Country of Origin"
                placeholder="e.g. Pakistan"
                value={values.countryOfOrigin || ""}
                onChange={(event) =>
                  updateField(
                    "countryOfOrigin",
                    event.target.value
                  )
                }
              />
            </>
          )}

          {isFabric && (
            <Select
              label="Fiber Type"
              placeholder="Select fiber type"
              options={FIBER_TYPE_OPTIONS}
              value={values.fiberType || ""}
              onChange={(value) =>
                updateField("fiberType", value)
              }
            />
          )}

          {isAccessory && (
            <Input
              label="Application"
              placeholder="e.g. Jackets, Sportswear, Bags"
              value={values.application || ""}
              onChange={(event) =>
                updateField(
                  "application",
                  event.target.value
                )
              }
            />
          )}
        </div>
      </div>
    </Card>
  );
}