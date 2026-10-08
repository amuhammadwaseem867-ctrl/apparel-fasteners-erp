"use client";

import { useMemo, useState } from "react";

import PageHeader from "@/components/layout/PageHeader";
import Stepper from "@/components/ui/Stepper";

import ProductBasicInfo from "@/components/products/ProductBasicInfo";
import ProductCategory from "@/components/products/ProductCategory";
import ProductSpecifications from "@/components/products/ProductSpecifications";
import ProductVariants from "@/components/products/ProductVariants";
import ProductInventory from "@/components/products/ProductInventory";
import ProductPricing from "@/components/products/ProductPricing";
import ProductReview from "@/components/products/ProductReview";
import ProductFormActions from "@/components/products/ProductFormActions";

import "./ProductForm.css";

const STEPS = [
  {
    id: "basic",
    title: "Basic Information",
  },
  {
    id: "category",
    title: "Category",
  },
  {
    id: "specifications",
    title: "Specifications",
  },
  {
    id: "variants",
    title: "Variants",
  },
  {
    id: "inventory",
    title: "Inventory",
  },
  {
    id: "pricing",
    title: "Pricing",
  },
  {
    id: "review",
    title: "Review",
  },
];

const INITIAL_FORM = {
  name: "",
  sku: "",
  brand: "",
  unit: "",
  barcode: "",
  internalReference: "",
  description: "",
  status: "active",
  division: "",
  subcategory: "",
};

const INITIAL_INVENTORY = {
  stockStatus: "stocked",
  stockUnit: "",
  openingStock: "",
  minimumStock: "",
  reorderLevel: "",
  safetyStock: "",
  warehouse: "",
  storageLocation: "",
  binRack: "",
  storageNotes: "",
  trackingMethod: "none",
  shelfLife: "",
  shelfLifeUnit: "days",
  batchTracking: false,
  serialTracking: false,
  expiryTracking: false,
  inventoryNotes: "",
};

const INITIAL_PRICING = {
  currency: "PKR",
  pricingUnit: "",
  purchaseCost: "",
  standardCost: "",
  sellingPrice: "",
  wholesalePrice: "",
  supplierPrice: "",
  minimumPurchasePrice: "",
  supplierLeadTime: "",
  supplierLeadTimeUnit: "days",
  targetMargin: "",
  minimumMargin: "",
  discountLimit: "",
  taxTreatment: "taxable",
  taxPricing: "exclusive",
  taxRate: "",
  pricingNotes: "",
};

export default function NewProductPage() {
  const [step, setStep] = useState(0);

  const [form, setForm] =
    useState(INITIAL_FORM);

  const [specifications, setSpecifications] =
    useState({});

  const [variants, setVariants] =
    useState([]);

  const [inventory, setInventory] =
    useState(INITIAL_INVENTORY);

  const [pricing, setPricing] =
    useState(INITIAL_PRICING);

  const [loading, setLoading] =
    useState(false);

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateSpecification(
    field,
    value
  ) {
    setSpecifications((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateInventory(
    field,
    value
  ) {
    setInventory((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updatePricing(
    field,
    value
  ) {
    setPricing((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const validation = useMemo(() => {
    const errors = {};

    if (!form.name.trim()) {
      errors.name = "Product name is required.";
    }

    if (!form.sku.trim()) {
      errors.sku = "SKU / Product Code is required.";
    }

    if (!form.unit.trim()) {
      errors.unit = "Product unit is required.";
    }

    if (!form.division) {
      errors.division =
        "Product division is required.";
    }

    if (!form.subcategory) {
      errors.subcategory =
        "Product subcategory is required.";
    }

    return errors;
  }, [form]);

  function validateStep() {
    if (step === 0) {
      if (
        !form.name.trim() ||
        !form.sku.trim() ||
        !form.unit.trim()
      ) {
        return false;
      }
    }

    if (step === 1) {
      if (
        !form.division ||
        !form.subcategory
      ) {
        return false;
      }
    }

    return true;
  }

  function handleNext() {
    if (!validateStep()) return;

    setStep((current) =>
      Math.min(
        current + 1,
        STEPS.length - 1
      )
    );
  }

  function handleBack() {
    setStep((current) =>
      Math.max(current - 1, 0)
    );
  }

  function handleCancel() {
    window.history.back();
  }

  async function handleSubmit() {
    if (
      Object.keys(validation).length > 0
    ) {
      setStep(0);
      return;
    }

    setLoading(true);

    try {
      const productPayload = {
        ...form,
        specifications,
        variants,
        inventory,
        pricing,
      };

      /* Backend integration pending. */

      /*
       * API / Prisma integration will be added later.
       *
       * Example:
       *
       * await fetch("/api/products", {
       *   method: "POST",
       *   headers: {
       *     "Content-Type": "application/json",
       *   },
       *   body: JSON.stringify(productPayload),
       * });
       */

      await new Promise((resolve) =>
        setTimeout(resolve, 600)
      );
    } finally {
      setLoading(false);
    }
  }

  function renderStep() {
    switch (STEPS[step].id) {
      case "basic":
        return (
          <ProductBasicInfo
            values={form}
            onChange={updateForm}
          />
        );

      case "category":
        return (
          <ProductCategory
            values={form}
            onChange={updateForm}
          />
        );

      case "specifications":
        return (
          <ProductSpecifications
            division={form.division}
            values={specifications}
            onChange={
              updateSpecification
            }
          />
        );

      case "variants":
        return (
          <ProductVariants
            division={form.division}
            variants={variants}
            onChange={setVariants}
          />
        );

      case "inventory":
        return (
          <ProductInventory
            values={inventory}
            onChange={updateInventory}
          />
        );

      case "pricing":
        return (
          <ProductPricing
            values={pricing}
            onChange={updatePricing}
          />
        );

      case "review":
        return (
          <ProductReview
            form={form}
            specifications={
              specifications
            }
            variants={variants}
            inventory={inventory}
            pricing={pricing}
          />
        );

      default:
        return null;
    }
  }

  return (
    <div className="product-form-page">
      <PageHeader
        title="Add Product"
        description="Create a new product master record."
      />

      <div className="product-form-stepper">
        <Stepper
          steps={STEPS}
          currentStep={step}
        />
      </div>

      <div className="product-form-content">
        {renderStep()}
      </div>

      <ProductFormActions
        currentStep={step}
        totalSteps={STEPS.length}
        onBack={handleBack}
        onNext={handleNext}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
        loading={loading}
        disabled={false}
      />
    </div>
  );
}