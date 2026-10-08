"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";

import useOrderStore from "@/lib/useOrderStore";

import {
  LOGO_TYPES,
  MATERIALS,
  RESPONSIBLE_DEPARTMENTS,
  ZIPPER_SIZES,
  ZIPPER_TYPES,
  COLOR_FINISHES,
} from "@/config/orders";
import { UNITS } from "@/config/items";

export default function EditOrderPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();

  const orderId = params?.id;

  const { getOrder, updateOrder } = useOrderStore([]);

  const order = getOrder(orderId);

  const [errors, setErrors] = useState({});
  const [form, setForm] = useState(() => ({
    customerName: order?.customerName || "",
    customerCode: order?.customerCode || "",
    orderDate: order?.orderDate || "",
    requiredDeliveryDate: order?.requiredDeliveryDate || "",
    zipperType: order?.zipperType || "",
    zipperSize: order?.zipperSize || "",
    material: order?.material || "",
    colorFinish: order?.colorFinish || "",
    logoType: order?.logoType || "plain",
    requiredQuantity: order?.requiredQuantity?.toString() || "",
    unit: order?.unit || "Pcs",
    productionPriority: order?.productionPriority || "normal",
    responsibleDepartment: order?.responsibleDepartment || "sales",
    productionStartDate: order?.productionStartDate || "",
    expectedCompletionDate: order?.expectedCompletionDate || "",
    remarks: order?.remarks || "",
  }));
  const [submitting, setSubmitting] = useState(false);

  if (!order) {
    return (
      <main className="order-form">
        <PageHeader
          eyebrow="Business / Sales & CRM / Orders"
          title="Edit Order"
          description="Order not found in the current ERP state."
        />

        <div className="order-form__content">
          <section className="order-form__card">
            <EmptyState
              title="Order not found"
              description="This order may have been deleted, or the backend isn't connected yet."
              action={
                <Button
                  variant="primary"
                  onClick={() => router.push("/sales/orders")}
                >
                  Go to Orders
                </Button>
              }
            />
          </section>
        </div>
      </main>
    );
  }

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));

    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate() {
    const next = {};

    if (!form.customerName.trim()) {
      next.customerName = "Customer name is required.";
    }

    if (!form.zipperType) next.zipperType = "Zipper type is required.";
    if (!form.zipperSize) next.zipperSize = "Zipper size is required.";
    if (!form.material) next.material = "Material is required.";

    if (!form.requiredQuantity || Number(form.requiredQuantity) <= 0) {
      next.requiredQuantity = "Required quantity must be greater than 0.";
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

    updateOrder(order.id, {
      customerName: form.customerName,
      customerCode: form.customerCode,
      orderDate: form.orderDate,
      requiredDeliveryDate: form.requiredDeliveryDate,
      zipperType: form.zipperType,
      zipperSize: form.zipperSize,
      material: form.material,
      colorFinish: form.colorFinish,
      logoType: form.logoType,
      requiredQuantity: Number(form.requiredQuantity) || 0,
      unit: form.unit,
      productionPriority: form.productionPriority,
      responsibleDepartment: form.responsibleDepartment,
      productionStartDate: form.productionStartDate,
      expectedCompletionDate: form.expectedCompletionDate,
      remarks: form.remarks,
    }, {
      action: "updated",
      field: "order_details",
      remarks: "Order details edited",
    });

    setSubmitting(false);

    toast.success({
      title: "Order updated",
      message: `${order.orderNumber} saved.`,
    });

    router.push(`/sales/orders/${order.id}`);
  }

  return (
    <main className="order-form">
      <PageHeader
        eyebrow="Business / Sales & CRM / Orders"
        title={`Edit ${order.orderNumber}`}
        description="Update order details. Stage and quantity history is preserved."
        action={
          <Button
            variant="secondary"
            icon={ArrowLeft}
            onClick={() => router.push(`/sales/orders/${order.id}`)}
          >
            Back to Profile
          </Button>
        }
      />

      <div className="order-form__content">
        <section className="order-form__card">
          <div className="order-form__card-heading">
            <h2>Customer &amp; Dates</h2>
          </div>

          <div className="order-form__grid order-form__grid--3">
            <Input
              label="Customer Name *"
              value={form.customerName}
              error={errors.customerName}
              onChange={(e) => setField("customerName", e.target.value)}
            />

            <Input
              label="Customer Code"
              value={form.customerCode}
              onChange={(e) => setField("customerCode", e.target.value)}
            />

            <Input
              label="Order Date"
              type="date"
              value={form.orderDate}
              onChange={(e) => setField("orderDate", e.target.value)}
            />

            <Input
              label="Required Delivery Date"
              type="date"
              value={form.requiredDeliveryDate}
              onChange={(e) =>
                setField("requiredDeliveryDate", e.target.value)
              }
            />

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
        </section>

        <section className="order-form__card">
          <div className="order-form__card-heading">
            <h2>Product Specification</h2>
          </div>

          <div className="order-form__grid order-form__grid--3">
            <Select
              label="Product / Zipper Type *"
              value={form.zipperType}
              error={errors.zipperType}
              onChange={(value) => setField("zipperType", value)}
              options={[
                { value: "", label: "Select zipper type" },
                ...ZIPPER_TYPES.map((type) => ({ value: type, label: type })),
              ]}
            />

            <Select
              label="Zipper Size *"
              value={form.zipperSize}
              error={errors.zipperSize}
              onChange={(value) => setField("zipperSize", value)}
              options={[
                { value: "", label: "Select size" },
                ...ZIPPER_SIZES.map((size) => ({ value: size, label: size })),
              ]}
            />

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

            <Select
              label="Logo / Plain"
              value={form.logoType}
              onChange={(value) => setField("logoType", value)}
              options={LOGO_TYPES.map((logo) => ({
                value: logo.id,
                label: logo.label,
              }))}
            />

            <Input
              label="Required Quantity *"
              type="number"
              min="1"
              value={form.requiredQuantity}
              error={errors.requiredQuantity}
              onChange={(e) => setField("requiredQuantity", e.target.value)}
            />

            <Select
              label="Unit"
              value={form.unit}
              onChange={(value) => setField("unit", value)}
              options={UNITS.map((unit) => ({ value: unit, label: unit }))}
            />
          </div>
        </section>

        <section className="order-form__card">
          <div className="order-form__card-heading">
            <h2>Schedule &amp; Remarks</h2>
          </div>

          <div className="order-form__grid order-form__grid--3">
            <Input
              label="Production Start Date"
              type="date"
              value={form.productionStartDate}
              onChange={(e) => setField("productionStartDate", e.target.value)}
            />

            <Input
              label="Expected Completion Date"
              type="date"
              value={form.expectedCompletionDate}
              onChange={(e) =>
                setField("expectedCompletionDate", e.target.value)
              }
            />

            <div className="order-form__field order-form__field--full">
              <Input
                label="Remarks / Special Instructions"
                value={form.remarks}
                onChange={(e) => setField("remarks", e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="order-form__actions">
          <Button
            variant="secondary"
            onClick={() => router.push(`/sales/orders/${order.id}`)}
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            icon={Save}
            loading={submitting}
            onClick={handleSubmit}
          >
            Save Changes
          </Button>
        </section>
      </div>
    </main>
  );
}
