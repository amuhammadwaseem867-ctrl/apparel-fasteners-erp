"use client";

import Card from "@/components/ui/Card";

import "./ProductCategory.css";

const CATEGORY_GROUPS = [
  {
    value: "garments",
    title: "Garments",
    description:
      "Finished apparel products including jackets, sweaters and other garments.",
    subcategories: [
      {
        value: "jackets",
        label: "Jackets",
      },
      {
        value: "sweaters",
        label: "Sweaters",
      },
      {
        value: "denim",
        label: "Denim",
      },
      {
        value: "bomber-jackets",
        label: "Bomber Jackets",
      },
      {
        value: "leather-garments",
        label: "Leather Garments",
      },
      {
        value: "other-garments",
        label: "Other Garments",
      },
    ],
  },
  {
    value: "fabrics",
    title: "Fabrics",
    description:
      "Textile materials used for garment production and other applications.",
    subcategories: [
      {
        value: "woven",
        label: "Woven",
      },
      {
        value: "knit",
        label: "Knit",
      },
      {
        value: "sustainable",
        label: "Sustainable",
      },
      {
        value: "technical",
        label: "Technical",
      },
      {
        value: "natural-fibers",
        label: "Natural Fibers",
      },
      {
        value: "recycled",
        label: "Recycled",
      },
      {
        value: "specialty",
        label: "Specialty",
      },
    ],
  },
  {
    value: "accessories",
    title: "Garment Accessories",
    description:
      "Trims, fasteners and supporting accessories used across apparel products.",
    subcategories: [
      {
        value: "zippers",
        label: "Zippers",
      },
      {
        value: "buttons",
        label: "Buttons",
      },
      {
        value: "interlining",
        label: "Interlining",
      },
      {
        value: "motifs",
        label: "Motifs",
      },
      {
        value: "velcro",
        label: "Velcro",
      },
      {
        value: "elastic",
        label: "Elastic",
      },
      {
        value: "cords",
        label: "Cords",
      },
      {
        value: "ribbons",
        label: "Ribbons",
      },
      {
        value: "toggles",
        label: "Toggles",
      },
      {
        value: "rivets",
        label: "Rivets",
      },
      {
        value: "hang-tags",
        label: "Hang Tags",
      },
      {
        value: "polybags",
        label: "Polybags",
      },
      {
        value: "elastic-tape",
        label: "Elastic Tape",
      },
      {
        value: "buttonhole-tape",
        label: "Buttonhole Tape",
      },
      {
        value: "welted-tape",
        label: "Welted Tape",
      },
      {
        value: "fringes",
        label: "Fringes",
      },
      {
        value: "tassels",
        label: "Tassels",
      },
      {
        value: "other-accessories",
        label: "Other Accessories",
      },
    ],
  },
];

export default function ProductCategory({
  values = {},
  onChange,
}) {
  const selectedGroup =
    CATEGORY_GROUPS.find(
      (group) => group.value === values.division
    ) || null;

  function selectDivision(division) {
    onChange?.("division", division);

    const group = CATEGORY_GROUPS.find(
      (item) => item.value === division
    );

    const currentSubcategory =
      values.subcategory;

    const exists = group?.subcategories.some(
      (item) => item.value === currentSubcategory
    );

    if (!exists) {
      onChange?.("subcategory", "");
    }
  }

  function selectSubcategory(subcategory) {
    onChange?.("subcategory", subcategory);
  }

  return (
    <div className="product-category">
      <Card
        title="Product Division"
        description="Select the main business division this product belongs to."
      >
        <div className="product-category-divisions">
          {CATEGORY_GROUPS.map((group) => {
            const selected =
              values.division === group.value;

            return (
              <button
                type="button"
                key={group.value}
                className={`product-category-division ${
                  selected ? "is-selected" : ""
                }`}
                onClick={() =>
                  selectDivision(group.value)
                }
              >
                <span className="product-category-division__indicator">
                  {selected ? "✓" : ""}
                </span>

                <span className="product-category-division__content">
                  <strong>{group.title}</strong>
                  <span>{group.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card
        title="Product Subcategory"
        description={
          selectedGroup
            ? `Select a subcategory under ${selectedGroup.title}.`
            : "Select a product division first."
        }
      >
        {!selectedGroup ? (
          <div className="product-category-empty">
            <strong>Select a division</strong>
            <p>
              Choose Garments, Fabrics or Garment
              Accessories to view available subcategories.
            </p>
          </div>
        ) : (
          <div className="product-category-subcategories">
            {selectedGroup.subcategories.map(
              (subcategory) => {
                const selected =
                  values.subcategory ===
                  subcategory.value;

                return (
                  <button
                    type="button"
                    key={subcategory.value}
                    className={`product-category-subcategory ${
                      selected ? "is-selected" : ""
                    }`}
                    onClick={() =>
                      selectSubcategory(
                        subcategory.value
                      )
                    }
                  >
                    <span className="product-category-subcategory__indicator">
                      {selected ? "✓" : ""}
                    </span>

                    <span>
                      {subcategory.label}
                    </span>
                  </button>
                );
              }
            )}
          </div>
        )}
      </Card>

      {selectedGroup && (
        <div className="product-category-summary">
          <div className="product-category-summary__item">
            <span>Division</span>
            <strong>
              {selectedGroup.title}
            </strong>
          </div>

          <div className="product-category-summary__item">
            <span>Subcategory</span>
            <strong>
              {values.subcategory
                ? selectedGroup.subcategories.find(
                    (item) =>
                      item.value ===
                      values.subcategory
                  )?.label || "Not selected"
                : "Not selected"}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}