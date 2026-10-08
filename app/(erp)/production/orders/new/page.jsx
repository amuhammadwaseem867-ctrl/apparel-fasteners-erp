"use client";

import {
  Plus,
  Save,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { PRODUCTION_STAGES } from "@/config/production";
import { UNITS } from "@/config/items";

import "./ProductionOrderForm.css";

/*
 * New Production Order — created from a confirmed sales order.
 * Backend entity mirror:
 * {
 *   orderNumber (sales order ref), customerName, customerCode,
 *   zipperType, zipperSize, material, colorFinish, logoType,
 *   requiredQuantity, unit, priority, currentStage,
 *   productionStartDate, expectedCompletionDate, remarks
 * }
 */

export default function NewProductionOrderPage() {
  return (
    <main className="prod-order-form">
      <PageHeader
        eyebrow="Factory Operations / Production"
        title="New Production Order"
        description="Create a production order from a confirmed sales order. The order starts at Tape Dyeing and flows through all nine stages."
      />

      <div className="prod-order-form__content">
        <section className="prod-order-form__card">
          <div className="prod-order-form__card-heading">
            <h2>Source Order</h2>
            <p>Link this production order to a confirmed sales order.</p>
          </div>

          <div className="prod-order-form__grid prod-order-form__grid--3">
            <div className="prod-order-form__field">
              <label>Sales Order</label>
              <Input placeholder="Select confirmed sales order" />
            </div>

            <div className="prod-order-form__field">
              <label>Customer</label>
              <Input placeholder="Auto-filled from order" />
            </div>

            <div className="prod-order-form__field">
              <label>Required Quantity / Unit</label>
              <div className="prod-order-form__qty-row">
                <Input type="number" min="0" placeholder="0" />
                <select className="prod-order-form__select">
                  {UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="prod-order-form__card">
          <div className="prod-order-form__card-heading">
            <h2>Specification</h2>
            <p>Product specification carried from the sales order.</p>
          </div>

          <div className="prod-order-form__grid prod-order-form__grid--3">
            <div className="prod-order-form__field">
              <label>Product / Zipper Type</label>
              <Input placeholder="Auto-filled" />
            </div>

            <div className="prod-order-form__field">
              <label>Zipper Size</label>
              <Input placeholder="Auto-filled" />
            </div>

            <div className="prod-order-form__field">
              <label>Material</label>
              <Input placeholder="Auto-filled" />
            </div>

            <div className="prod-order-form__field">
              <label>Color / Finish</label>
              <Input placeholder="Auto-filled" />
            </div>

            <div className="prod-order-form__field">
              <label>Logo / Plain</label>
              <Input placeholder="Auto-filled" />
            </div>

            <div className="prod-order-form__field">
              <label>Production Priority</label>
              <select className="prod-order-form__select" defaultValue="normal">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
        </section>

        <section className="prod-order-form__card">
          <div className="prod-order-form__card-heading">
            <h2>Schedule</h2>
            <p>Production dates and responsible department.</p>
          </div>

          <div className="prod-order-form__grid prod-order-form__grid--3">
            <div className="prod-order-form__field">
              <label>Production Start Date</label>
              <Input type="date" />
            </div>

            <div className="prod-order-form__field">
              <label>Expected Completion Date</label>
              <Input type="date" />
            </div>

            <div className="prod-order-form__field">
              <label>Responsible Department</label>
              <select className="prod-order-form__select" defaultValue="production">
                <option value="production">Production</option>
                <option value="quality">Quality Control</option>
                <option value="packing">Packing</option>
              </select>
            </div>

            <div className="prod-order-form__field prod-order-form__field--full">
              <label>Remarks</label>
              <textarea
                className="prod-order-form__textarea"
                rows={3}
                placeholder="Special production instructions..."
              />
            </div>
          </div>
        </section>

        <section className="prod-order-form__stages">
          <div className="prod-order-form__card-heading">
            <h2>Stage Sequence</h2>
            <p>
              The order will be created with a stage record for each
              of these nine stages.
            </p>
          </div>

          <div className="prod-order-form__stage-track">
            {PRODUCTION_STAGES.map((stage) => (
              <div className="prod-order-form__stage" key={stage.key}>
                <span>{String(stage.sequence).padStart(2, "0")}</span>
                <strong>{stage.label}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="prod-order-form__actions">
          <Button variant="secondary">Cancel</Button>

          <Button variant="primary" icon={Save} disabled>
            Create Production Order
          </Button>
        </section>
      </div>
    </main>
  );
}
