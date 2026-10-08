"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/ToastProvider";

import useOrderStore from "@/lib/useOrderStore";

import {
  LOGO_TYPES,
  MATERIALS,
  ORDER_ATTACHMENT_TYPES,
  RESPONSIBLE_DEPARTMENTS,
  ZIPPER_SIZES,
  ZIPPER_TYPES,
  COLOR_FINISHES,
} from "@/config/orders";
import { UNITS } from "@/config/items";

import "./OrderForm.css";

const EMPTY_FORM = {
  orderNumber: "",
  customerName: "",
  customerCode: "",
  orderDate: "",
  requiredDeliveryDate: "",
  zipperType: "",
  zipperSize: "",
  material: "",
  colorFinish: "",
  logoType: "plain",
  requiredQuantity: "",
  unit: "Pcs",
  productionPriority: "normal",
  responsibleDepartment: "sales",
  productionStartDate: "",
  expectedCompletionDate: "",
  remarks: "",
};

export default function NewOrderPage() {
  const router = useRouter();
  const toast = useToast();

  const { createOrder } = useOrderStore([]);

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));

    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate() {
    const next = {};

    if (!form.customerName.trim()) {
      next.customerName = "Customer name is required.";
    }

    if (!form.orderDate) {
      next.orderDate = "Order date is required.";
    }

    if (!form.zipperType) {
      next.zipperType = "Zipper type is required.";
    }

    if (!form.zipperSize) {
      next.zipperSize = "Zipper size is required.";
    }

    if (!form.material) {
      next.material = "Material is required.";
    }

    if (!form.requiredQuantity || Number(form.requiredQuantity) <= 0) {
      next.requiredQuantity = "Required quantity must be greater than 0.";
    }

    if (!form.requiredDeliveryDate) {
      next.requiredDeliveryDate = "Required delivery date is required.";
    }

    return next;
  }

  function handleSubmit() {
    const validation = validate();

    if (Object.keys(validation).length > 0) {
      setErrors(validation);

      toast.error({
        title: "Cannot save order",
        message: "Please fix the highlighted fields.",
      });

      return;
    }

    setSubmitting(true);

    const order = createOrder(form);

    setSubmitting(false);

    toast.success({
      title: "Order created",
      message: `${order.orderNumber} created. Trace it from the Order Profile.`,
    });

    router.push(`/sales/orders/${order.id}`);
  }

  return (
    <main className="order-form">
      <PageHeader
        eyebrow="Business / Sales & CRM / Orders"
        title="New Order"
        description="Create a zipper manufacturing order. The order starts at Tape Dyeing and flows through all nine production stages."
        action={
          <Button
            variant="secondary"
            icon={ArrowLeft}
            onClick={() => router.push("/sales/orders")}
          >
            Back to Orders
          </Button>
        }
      />

      <div className="order-form__content">
        <section className="order-form__card">
          <div className="order-form__card-heading">
            <h2>Order Header</h2>

            <p>Order identity, customer and dates.</p>
          </div>

          <div className="order-form__grid order-form__grid--3">
            <div className="order-form__field">
              <Input
                label="Order Number / ID"
                placeholder="Auto-generated if left empty"
                value={form.orderNumber}
                onChange={(event) =>
                  setField("orderNumber", event.target.value)
                }
              />
            </div>

            <div className="order-form__field">
              <Input
                label="Customer Name *"
                placeholder="e.g. Northstar Apparel"
                value={form.customerName}
                error={errors.customerName}
                onChange={(event) =>
                  setField("customerName", event.target.value)
                }
              />
            </div>

            <div className="order-form__field">
              <Input
                label="Customer Code"
                placeholder="e.g. CUST-001"
                value={form.customerCode}
                onChange={(event) =>
                  setField("customerCode", event.target.value)
                }
              />
            </div>

            <div className="order-form__field">
              <Input
                label="Order Date *"
                type="date"
                value={form.orderDate}
                error={errors.orderDate}
                onChange={(event) => setField("orderDate", event.target.value)}
              />
            </div>

            <div className="order-form__field">
              <Input
                label="Required Delivery Date *"
                type="date"
                value={form.requiredDeliveryDate}
                error={errors.requiredDeliveryDate}
                onChange={(event) =>
                  setField("requiredDeliveryDate", event.target.value)
                }
              />
            </div>

            <div className="order-form__field">
              <Select
                label="Production Priority"
                value={form.productionPriority}
                onChange={(value) => setField("productionPriority", value)}
                options={[
                  { value: "low", label: "Low" },
                  { value: "normal", label: "Normal" },
                  { value: "high", label: "High" },
                  { value: "urgent", label: "Urgent" },
                ]}
              />
            </div>
          </div>
        </section>

        <section className="order-form__card">
          <div className="order-form__card-heading">
            <h2>Product Specification</h2>

            <p>Zipper specification for this order.</p>
          </div>

          <div className="order-form__grid order-form__grid--3">
            <div className="order-form__field">
              <Select
                label="Product / Zipper Type *"
                value={form.zipperType}
                error={errors.zipperType}
                onChange={(value) => setField("zipperType", value)}
                options={[
                  { value: "", label: "Select zipper type" },
                  ...ZIPPER_TYPES.map((type) => ({
                    value: type,
                    label: type,
                  })),
                ]}
              />
            </div>

            <div className="order-form__field">
              <Select
                label="Zipper Size *"
                value={form.zipperSize}
                error={errors.zipperSize}
                onChange={(value) => setField("zipperSize", value)}
                options={[
                  { value: "", label: "Select size" },
                  ...ZIPPER_SIZES.map((size) => ({
                    value: size,
                    label: size,
                  })),
                ]}
              />
            </div>

            <div className="order-form__field">
              <Select
                label="Material *"
                value={form.material}
                error={errors.material}
                onChange={(value) => setField("material", value)}
                options={[
                  { value: "", label: "Select material" },
                  ...MATERIALS.map((material) => ({
                    value: material,
                    label: material,
                  })),
                ]}
              />
            </div>

            <div className="order-form__field">
              <Select
                label="Color / Finish"
                value={form.colorFinish}
                onChange={(value) => setField("colorFinish", value)}
                options={[
                  { value: "", label: "Select color / finish" },
                  ...COLOR_FINISHES.map((finish) => ({
                    value: finish,
                    label: finish,
                  })),
                ]}
              />
            </div>

            <div className="order-form__field">
              <Select
                label="Logo / Plain"
                value={form.logoType}
                onChange={(value) => setField("logoType", value)}
                options={LOGO_TYPES.map((logo) => ({
                  value: logo.id,
                  label: logo.label,
                }))}
              />
            </div>

            <div className="order-form__field">
              <Input
                label="Required Quantity *"
                type="number"
                min="1"
                placeholder="0"
                value={form.requiredQuantity}
                error={errors.requiredQuantity}
                onChange={(event) =>
                  setField("requiredQuantity", event.target.value)
                }
              />
            </div>

            <div className="order-form__field">
              <Select
                label="Unit"
                value={form.unit}
                onChange={(value) => setField("unit", value)}
                options={UNITS.map((unit) => ({
                  value: unit,
                  label: unit,
                }))}
              />
            </div>

            <div className="order-form__field">
              <Select
                label="Responsible Department"
                value={form.responsibleDepartment}
                onChange={(value) => setField("responsibleDepartment", value)}
                options={RESPONSIBLE_DEPARTMENTS.map((department) => ({
                  value: department.id,
                  label: department.label,
                }))}
              />
            </div>
          </div>
        </section>

        <section className="order-form__card">
          <div className="order-form__card-heading">
            <h2>Production Schedule</h2>

            <p>Planning dates and remarks.</p>
          </div>

          <div className="order-form__grid order-form__grid--3">
            <div className="order-form__field">
              <Input
                label="Production Start Date"
                type="date"
                value={form.productionStartDate}
                onChange={(event) =>
                  setField("productionStartDate", event.target.value)
                }
              />
            </div>

            <div className="order-form__field">
              <Input
                label="Expected Completion Date"
                type="date"
                value={form.expectedCompletionDate}
                onChange={(event) =>
                  setField("expectedCompletionDate", event.target.value)
                }
              />
            </div>

            <div className="order-form__field order-form__field--full">
              <Input
                label="Remarks / Special Instructions"
                placeholder="Special instructions for production, QC, packing or delivery..."
                value={form.remarks}
                onChange={(event) => setField("remarks", event.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="order-form__card">
          <div className="order-form__card-heading">
            <h2>Attachments</h2>

            <p>
              Attach Purchase Order, Order Sheet, Specification,
              Artwork / Logo, Packing Instructions and other
              documents after the order is created — from the Order
              Profile.
            </p>
          </div>

          <div className="order-form__attachments">
            {ORDER_ATTACHMENT_TYPES.map((type) => (
              <div className="order-form__attachment" key={type.id}>
                <strong>{type.label}</strong>

                <span>Available on the Order Profile after creation</span>
              </div>
            ))}
          </div>
        </section>

        <section className="order-form__actions">
          <Button
            variant="secondary"
            onClick={() => router.push("/sales/orders")}
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            icon={Save}
            loading={submitting}
            onClick={handleSubmit}
          >
            Create Order
          </Button>
        </section>
      </div>
    </main>
  );
}
