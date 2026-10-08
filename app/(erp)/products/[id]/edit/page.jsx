"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Stepper from "@/components/ui/Stepper";

import ProductBasicInfo from "@/components/products/ProductBasicInfo";
import ProductCategory from "@/components/products/ProductCategory";
import ProductSpecifications from "@/components/products/ProductSpecifications";
import ProductVariants from "@/components/products/ProductVariants";
import ProductInventory from "@/components/products/ProductInventory";
import ProductPricing from "@/components/products/ProductPricing";
import ProductReview from "@/components/products/ProductReview";

import "./ProductEdit.css";

const steps = [
  { label: "Basic Information" },
  { label: "Category" },
  { label: "Specifications" },
  { label: "Variants" },
  { label: "Inventory" },
  { label: "Pricing" },
  { label: "Review" },
];

/* Product values are loaded from the backend by id once connected. No seeded sample product. */


export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();

  const productId = params?.id;

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  /*
   * Form starts empty. Values are loaded from the backend by
   * productId once connected.
   */
  const [form, setForm] = useState({
    name: "",
    sku: "",
    brand: "",
    unit: "pcs",
    barcode: "",
    internalReference: "",
    description: "",
    status: "active",
    division: "",
    subcategory: "",
  });

  const [specifications, setSpecifications] = useState({});

  const [variants, setVariants] = useState([]);

  const [inventory, setInventory] = useState({});

  const [pricing, setPricing] = useState({});

  const reviewData = useMemo(
    () => ({
      ...form,
      specifications,
      variants,
      inventory,
      pricing,
    }),
    [form, specifications, variants, inventory, pricing]
  );

  function updateForm(updates) {
    setForm((current) => ({
      ...current,
      ...updates,
    }));
  }

  function validateStep() {
    if (step === 0) {
      if (!form.name.trim()) {
        alert("Product name is required.");
        return false;
      }

      if (!form.sku.trim()) {
        alert("SKU / Product Code is required.");
        return false;
      }

      if (!form.unit) {
        alert("Unit is required.");
        return false;
      }
    }

    if (step === 1) {
      if (!form.division) {
        alert("Product division is required.");
        return false;
      }

      if (!form.subcategory) {
        alert("Product subcategory is required.");
        return false;
      }
    }

    return true;
  }

  function handleNext() {
    if (!validateStep()) return;

    setStep((current) =>
      Math.min(current + 1, steps.length - 1)
    );
  }

  function handleBack() {
    if (step === 0) {
      router.push(`/products/${productId}`);
      return;
    }

    setStep((current) => Math.max(current - 1, 0));
  }

  async function handleSave() {
    if (!validateStep()) return;

    setLoading(true);

    const payload = {
      id: productId,
      ...form,
      specifications,
      variants,
      inventory,
      pricing,
    };

    /* Backend integration pending. */

    await new Promise((resolve) => setTimeout(resolve, 700));

    setLoading(false);

    router.push(`/products/${productId}`);
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <ProductBasicInfo
            value={form}
            onChange={updateForm}
          />
        );

      case 1:
        return (
          <ProductCategory
            value={{
              division: form.division,
              subcategory: form.subcategory,
            }}
            onChange={updateForm}
          />
        );

      case 2:
        return (
          <ProductSpecifications
            division={form.division}
            value={specifications}
            onChange={setSpecifications}
          />
        );

      case 3:
        return (
          <ProductVariants
            division={form.division}
            variants={variants}
            onChange={setVariants}
          />
        );

      case 4:
        return (
          <ProductInventory
            value={inventory}
            onChange={setInventory}
          />
        );

      case 5:
        return (
          <ProductPricing
            value={pricing}
            onChange={setPricing}
          />
        );

      case 6:
        return (
          <ProductReview
            data={reviewData}
          />
        );

      default:
        return null;
    }
  }

  return (
    <div className="product-edit-page">
      <PageHeader
        title="Edit Product"
        description={`Update ${
          form.name || productId
        }`}
        action={
          <Button
            variant="secondary"
            onClick={() =>
              router.push(`/products/${productId}`)
            }
          >
            <ArrowLeft size={16} />
            Back to Product
          </Button>
        }
      />

      <div className="product-edit__stepper">
        <Stepper
          steps={steps}
          currentStep={step}
        />
      </div>

      <main className="product-edit__content">
        <div className="product-edit__form">
          {renderStep()}
        </div>
      </main>

      <div className="product-edit__actions">
        <Button
          variant="secondary"
          onClick={handleBack}
          disabled={loading}
        >
          <ArrowLeft size={16} />
          {step === 0 ? "Cancel" : "Back"}
        </Button>

        <div className="product-edit__actions-right">
          {step < steps.length - 1 ? (
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={loading}
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleSave}
              loading={loading}
            >
              <Save size={16} />
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
