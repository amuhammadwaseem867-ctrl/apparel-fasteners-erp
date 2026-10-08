"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
} from "lucide-react";

import Button from "@/components/ui/Button";

import "./ProductFormActions.css";

export default function ProductFormActions({
  currentStep = 0,
  totalSteps = 1,
  onBack,
  onNext,
  onCancel,
  onSubmit,
  loading = false,
  disabled = false,
}) {
  const isFirstStep = currentStep === 0;
  const isLastStep =
    currentStep >= totalSteps - 1;

  function handleBack() {
    if (loading) return;
    onBack?.();
  }

  function handleNext() {
    if (loading || disabled) return;
    onNext?.();
  }

  function handleSubmit() {
    if (loading || disabled) return;
    onSubmit?.();
  }

  return (
    <div className="product-form-actions">
      <div className="product-form-actions__left">
        <Button
          type="button"
          variant="secondary"
          icon={X}
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>

      <div className="product-form-actions__right">
        {!isFirstStep && (
          <Button
            type="button"
            variant="secondary"
            icon={ArrowLeft}
            onClick={handleBack}
            disabled={loading}
          >
            Back
          </Button>
        )}

        {isLastStep ? (
          <Button
            type="button"
            icon={Check}
            onClick={handleSubmit}
            loading={loading}
            disabled={disabled}
          >
            {loading
              ? "Creating Product..."
              : "Create Product"}
          </Button>
        ) : (
          <Button
            type="button"
            icon={ArrowRight}
            iconPosition="right"
            onClick={handleNext}
            disabled={disabled || loading}
          >
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}