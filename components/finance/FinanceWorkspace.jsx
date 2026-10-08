"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  Eye,
  FileText,
  Filter,
  Plus,
  Search,
  X,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import FilterPanel from "@/components/ui/FilterPanel";
import Modal, { ConfirmModal } from "@/components/ui/Modal";
import Table from "@/components/ui/Tables";
import { useToast } from "@/components/ui/ToastProvider";

const emptyFilters = (fields = []) => Object.fromEntries(fields.map((field) => [field.key, ""]));
const empty = (value) => value === undefined || value === null || value === "";
const display = (value) => empty(value) ? "—" : String(value);
const formBlank = (fields) => Object.fromEntries(fields.map((field) => [field.key, field.type === "file" ? null : ""]));
const paymentFields = [
  { key: "date", label: "Date", type: "date", required: true },
  { key: "party", label: "Customer/Supplier", type: "text", required: true },
  { key: "amount", label: "Amount", type: "number", required: true, min: "0", step: "0.01" },
  { key: "reference", label: "Payment Reference", type: "text" },
  { key: "remarks", label: "Remarks", type: "textarea" },
];

function lineTotal(line) {
  if (!line.description?.trim() || empty(line.quantity) || empty(line.unitPrice)) return null;
  const quantity = Number(line.quantity) || 0;
  const price = Number(line.unitPrice) || 0;
  return Math.max(0, quantity * price + (Number(line.tax) || 0) - (Number(line.discount) || 0));
}

function invoiceTotal(form) {
  const items = form.lineItems || [];
  if (!items.length || items.some((line) => lineTotal(line) === null)) return null;
  const lines = items.reduce((total, line) => total + lineTotal(line), 0);
  return Math.max(0, lines + (Number(form.tax) || 0) - (Number(form.discount) || 0));
}

function fieldOptions(field, accounts) {
  if (field.type === "accountSelect") {
    return accounts.filter((account) => account.status === "Active").map((account) => account.name);
  }
  return field.options || [];
}

export default function FinanceWorkspace({ config }) {
  const toast = useToast();
  const [records, setRecords] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [filters, setFilters] = useState(() => emptyFilters(config.filters));
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [mode, setMode] = useState("add");
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [detail, setDetail] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const confirmRef = useRef(false);
  const [report, setReport] = useState(null);
  const [section, setSection] = useState("accounts");

  const formFields = mode === "payment"
    ? config.invoice
      ? [{ key: "amount", label: "Payment Amount", type: "number", required: true, min: "0.01", step: "0.01" }]
      : paymentFields
    : config.cashBank && mode === "transaction"
      ? config.transactionFields
      : config.fields;
  const sourceRows = config.cashBank && section === "transactions" ? transactions : records;
  const currentFilterFields = config.cashBank && section === "transactions"
    ? config.transactionFilters
    : config.filters || [];
  const currentSearchKeys = config.cashBank && section === "transactions"
    ? ["date", "reference", "type", "account", "amount", "description"]
    : config.searchKeys || [];
  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = sourceRows.filter((row) => {
      const matchesSearch = !query || currentSearchKeys.some((key) => String(row[key] ?? "").toLowerCase().includes(query));
      const matchesFilters = Object.entries(filters).every(([key, value]) => {
        if (!value) return true;
        const rowValue = String(row[key] ?? "").toLowerCase();
        const recordDate = row.date || row.invoiceDate || row.billDate;
        if (key === "fromDate") return Boolean(recordDate) && String(recordDate) >= value;
        if (key === "toDate") return Boolean(recordDate) && String(recordDate) <= value;
        if (currentFilterFields.find((field) => field.key === key)?.type === "select") return rowValue === String(value).toLowerCase();
        return rowValue.includes(String(value).toLowerCase());
      });
      return matchesSearch && matchesFilters;
    });
    return rows;
  }, [sourceRows, search, filters, currentSearchKeys, currentFilterFields]);

  function openForm(nextMode = "add", record = null) {
    const fields = nextMode === "payment"
      ? config.invoice
        ? [{ key: "amount", label: "Payment Amount", type: "number", required: true, min: "0.01", step: "0.01" }]
        : paymentFields
      : nextMode === "transaction"
        ? config.transactionFields
        : config.fields;
    const base = formBlank(fields);
    const initial = record ? { ...base, ...record } : base;
    if (config.invoice) initial.lineItems = record?.lineItems?.map((line) => ({ ...line })) || [{ description: "", quantity: "", unitPrice: "", tax: "", discount: "" }];
    if (config.cashBank && nextMode === "transaction") initial.account = records.find((item) => item.status === "Active")?.name || "";
    setMode(nextMode);
    setForm(initial);
    setErrors({});
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setErrors({});
    setForm({});
  }

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function validate() {
    const nextErrors = {};
    (formFields || []).forEach((field) => {
      const value = form[field.key];
      if (field.required && (empty(value) || typeof value === "string" && !value.trim())) nextErrors[field.key] = `${field.label} is required.`;
      if (field.type === "number" && !empty(value) && (!Number.isFinite(Number(value)) || Number(value) < Number(field.min || 0))) {
        nextErrors[field.key] = `${field.label} must be a valid number${field.min === "0" ? " greater than or equal to 0" : ""}.`;
      }
    });
    if (config.slug === "accounts" && mode !== "transaction" && form.code) {
      const duplicate = records.some((item) => item.code?.trim().toLowerCase() === String(form.code).trim().toLowerCase() && item.id !== form.id);
      if (duplicate) nextErrors.code = "An account with this code already exists.";
    }
    if (config.invoice && mode !== "payment") {
      if (form.invoiceDate && form.dueDate && form.dueDate < form.invoiceDate) nextErrors.dueDate = "Due date must be on or after invoice date.";
      const items = form.lineItems || [];
      if (!items.length || items.some((item) => !item.description.trim() || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0 || !Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0 || [item.tax, item.discount].some((value) => value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0)))) {
        nextErrors.lineItems = "Add a description, a quantity greater than 0, and valid non-negative prices, tax and discounts for every line.";
      }
    }
    if (mode === "payment" && config.invoice && Number(form.amount) > Number(form.balance)) nextErrors.amount = "Payment cannot exceed the outstanding balance.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function saveForm(event) {
    event.preventDefault();
    if (savingRef.current || !validate()) return;
    savingRef.current = true;
    setSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    const nowId = form.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (mode === "payment" && config.invoice) {
      const amount = Number(form.amount);
      setRecords((current) => current.map((item) => {
        if (item.id !== form.id) return item;
        const paid = (Number(item.paid) || 0) + amount;
        return { ...item, paid, balance: Math.max(0, Number(item.total) - paid), status: paid >= Number(item.total) ? "Paid" : "Partially Paid" };
      }));
    } else if (mode === "payment" && config.readOnly) {
      setTransactions((current) => [...current, { ...form, id: nowId, status: "Recorded" }]);
    } else if (config.cashBank && mode === "transaction") {
      setTransactions((current) => [{ ...form, id: nowId, status: "Recorded", balance: "" }, ...current]);
    } else if (mode === "edit") {
      setRecords((current) => current.map((item) => {
        if (item.id !== form.id) return item;
        if (!config.invoice) {
          const updated = { ...form };
          if (updated.attachment) updated.attachmentName = updated.attachment.name;
          delete updated.attachment;
          return updated;
        }
        const total = invoiceTotal(form);
        return { ...form, total, balance: Math.max(0, total - Number(item.paid || 0)), paid: Number(item.paid || 0) };
      }));
    } else {
      const record = { ...form, id: nowId };
      if (config.invoice) {
        const total = invoiceTotal(form);
        Object.assign(record, { number: form.number || `INV-${nowId}`, total, paid: 0, balance: total, status: "Draft" });
      }
      else if (!record.status) record.status = ["income", "expenses", "payments"].includes(config.slug) ? "Recorded" : "Draft";
      if (record.attachment) record.attachmentName = record.attachment.name;
      delete record.attachment;
      setRecords((current) => [record, ...current]);
    }
    savingRef.current = false;
    setSaving(false);
    setFormOpen(false);
    setForm({});
    toast.success({ title: mode === "edit" ? "Changes saved" : "Record saved", message: "The record is available in this page's frontend state." });
  }

  function requestAction(action, record) {
    if (action === "view" || action === "viewInvoice" || action === "viewCustomer" || action === "viewSupplier" || action === "source") {
      setDetail({ ...record, detailAction: action });
      return;
    }
    if (action === "edit") {
      openForm("edit", record);
      return;
    }
    if (action === "payment") {
      if (config.invoice) {
        openForm("payment", { id: record.id, balance: record.balance });
      } else {
        openForm("payment", { id: record.id, party: record.customer || record.supplier || "", invoiceReference: record.invoice || record.bill || "" });
      }
      return;
    }
    const prompts = {
      cancel: { title: "Cancel this record?", message: "The record will be marked cancelled and will no longer be editable.", label: "Cancel record", status: "Cancelled" },
      toggle: { title: `${record.status === "Active" ? "Deactivate" : "Activate"} this account?`, message: "The account status will change in this page's frontend state.", label: record.status === "Active" ? "Deactivate" : "Activate", status: record.status === "Active" ? "Inactive" : "Active" },
      issue: { title: "Issue this invoice?", message: "Issuing an invoice changes it from draft to issued.", label: "Issue invoice", status: "Issued" },
    };
    if (prompts[action]) setConfirmation({ ...prompts[action], action, record });
  }

  async function confirmAction() {
    if (!confirmation || confirmRef.current) return;
    confirmRef.current = true;
    setConfirmLoading(true);
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    const { action, record, status } = confirmation;
    setRecords((current) => current.map((item) => item.id === record.id ? { ...item, status } : item));
    setConfirmation(null);
    confirmRef.current = false;
    setConfirmLoading(false);
    toast.success({ title: status === "Cancelled" ? "Record cancelled" : status === "Issued" ? "Invoice issued" : `Account ${status.toLowerCase()}` });
  }

  function renderActionButton(action, record) {
    const labels = {
      view: "View", viewInvoice: "View Invoice", viewCustomer: "View Customer",
      viewSupplier: "View Supplier", source: "View Source", edit: "Edit",
      toggle: record.status === "Active" ? "Deactivate" : "Activate",
      cancel: "Cancel", issue: "Issue", payment: "Record Payment",
    };
    const hidden = (action === "edit" && (record.status === "Cancelled" || record.status === "Paid" || record.status === "Issued" && config.invoice)) ||
      (action === "issue" && record.status !== "Draft") ||
      (action === "payment" && config.invoice && (!["Issued", "Partially Paid", "Overdue"].includes(record.status) || Number(record.balance) <= 0)) ||
      (action === "cancel" && (record.status === "Cancelled" || config.invoice && !["Draft", "Issued"].includes(record.status))) ||
      (action === "toggle" && record.status === "Cancelled");
    if (hidden) return null;
    return (
      <button type="button" key={action} className="finance-row-action" onClick={() => requestAction(action, record)}>
        {action === "view" ? <Eye size={14} /> : null}{labels[action]}
      </button>
    );
  }

  function renderTable(rows, columns, actions, emptyTitle) {
    if (rows.length === 0) {
      return <EmptyState icon={FileText} title={search || Object.values(filters).some(Boolean) ? "No matching records" : emptyTitle} description="Financial data will appear here once records are entered or accounting data is connected." />;
    }
    const tableColumns = columns.map(([key, label]) => ({
      key,
      label,
      render: (cellValue, record) => {
        let value = cellValue;
        if (config.cashBank && key === "currentBalance") value = "";
        if (config.cashBank && section === "transactions" && key === "balance") value = "";
        return (
              <>
                <span className="finance-mobile-label">{label}</span>
                {key === "status" && value
                  ? <span className={`finance-status finance-status--${String(value).toLowerCase().replaceAll(" ", "-")}`}>{value}</span>
                  : display(value)}
              </>
        );
      },
    }));
    return (
      <div className="finance-shared-table">
        <Table
              columns={tableColumns}
              data={rows}
              rowKey="id"
              sortable
              compact
              rowActions={actions?.length ? (record) => <div className="finance-row-actions"><span className="finance-mobile-label">Actions</span>{actions.map((action) => renderActionButton(action, record))}</div> : undefined}
        />
      </div>
    );
  }

  function doGenerateReport() {
    if (!form.type) {
      setErrors((current) => ({ ...current, type: "Report Type is required." }));
      return;
    }
    setReport({ title: form.type || "Financial Report", filters: { ...form }, generatedAt: new Date().toLocaleString() });
    setErrors({});
    toast.success({ title: "Report generated", message: "The report view was refreshed. No reporting data is currently connected." });
  }

  if (config.report) {
    return (
      <main className={`finance-workspace finance-workspace--${config.slug}`}>
        <PageHeader eyebrow="FINANCE" title={config.title} description={config.description} />
        <section className="finance-report-filters">
          {config.fields.map((field) => renderField(field, form, updateField, errors, [], false))}
          <div className="finance-report-actions">
            <Button icon={FileText} onClick={doGenerateReport}>Generate Report</Button>
            <Button variant="secondary" icon={X} onClick={() => { setForm(formBlank(config.fields)); setErrors({}); setReport(null); }}>Clear Filters</Button>
          </div>
        </section>
        <section className="finance-report-panel">
          <div className="finance-report-panel__heading">
            <div><span className="finance-section-kicker">REPORT OUTPUT</span><h2>{report?.title || "Report preview"}</h2></div>
            <span>{report ? `Generated ${report.generatedAt}` : "Not generated"}</span>
          </div>
          {report && <div className="finance-report-selected"><strong>Selected filters</strong>{Object.entries(report.filters).filter(([, value]) => !empty(value)).map(([key, value]) => <span key={key}>{fieldLabel(config.fields, key)}: {value}</span>)}</div>}
          <EmptyState icon={FileText} title="No reporting data available" description="Report rows and visualizations will appear when connected accounting data is available." />
        </section>
      </main>
    );
  }

  return (
    <main className={`finance-workspace finance-workspace--${config.slug}`}>
      <PageHeader eyebrow="FINANCE" title={config.title} description={config.description}>
        {config.addLabel && <Button icon={Plus} onClick={() => openForm("add")}>{config.addLabel}</Button>}
        {config.secondaryLabel && <Button variant="secondary" icon={ArrowDownUp} onClick={() => openForm("transaction")}>{config.secondaryLabel}</Button>}
      </PageHeader>

      {config.kpis && <section className="finance-kpi-grid">{config.kpis.map((label) => <div className="finance-kpi-card" key={label}><span>{label}</span><strong>—</strong><small>Awaiting connected accounting data</small></div>)}</section>}

      {config.cashBank && <div className="finance-section-tabs" role="tablist" aria-label="Cash and bank sections">
        <button type="button" role="tab" aria-selected={section === "accounts"} className={section === "accounts" ? "is-active" : ""} onClick={() => { setSection("accounts"); setSearch(""); setFilters(emptyFilters(config.filters)); }}>Accounts</button>
        <button type="button" role="tab" aria-selected={section === "transactions"} className={section === "transactions" ? "is-active" : ""} onClick={() => { setSection("transactions"); setSearch(""); setFilters(emptyFilters(config.transactionFilters)); }}>Transactions</button>
      </div>}

      <section className="finance-list-panel">
        <div className="finance-list-toolbar">
          <label className="finance-search"><Search size={16} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records..." aria-label="Search finance records" /><button type="button" aria-label="Clear search" onClick={() => setSearch("")} disabled={!search}><X size={14} /></button></label>
          {(config.filters?.length > 0 || config.transactionFilters?.length > 0) && <Button variant="secondary" icon={Filter} onClick={() => setFilterOpen(true)}>Filter</Button>}
          <Button variant="ghost" onClick={() => { setSearch(""); setFilters(emptyFilters(currentFilterFields)); }}>Clear Filters</Button>
        </div>
        {renderTable(visibleRows, config.cashBank && section === "transactions" ? config.transactionColumns || [["date", "Date"], ["reference", "Reference"], ["type", "Transaction Type"], ["account", "Account"], ["amount", "Amount"], ["description", "Description"], ["balance", "Balance"]] : config.columns, config.cashBank && section === "transactions" ? ["view"] : config.actions, config.cashBank && section === "transactions" ? "No cash or bank transactions available" : config.emptyTitle)}
      </section>

      <FilterPanel open={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} fields={currentFilterFields.map((field) => ({ ...field, options: field.key === "account" && config.cashBank ? records.map((record) => ({ value: record.name, label: record.name })) : (field.options || []).map((option) => ({ value: option, label: option })) }))} searchValue={search} showSearch onSearchChange={setSearch} onApply={(next) => { setFilters(next); setFilterOpen(false); }} onReset={(next) => { setFilters(next); setSearch(""); }} title={`Filter ${config.title}`} />

      <Modal open={formOpen} onClose={closeForm} title={formTitle(config, mode)} description={mode === "payment" ? "Enter payment details to update the frontend record." : `Enter ${config.recordName || "record"} details.`} size="large" loading={saving} footer={<div className="finance-form-actions"><Button type="button" variant="secondary" onClick={closeForm} disabled={saving}>Cancel</Button><Button type="submit" form="finance-record-form" loading={saving}>{mode === "edit" ? "Save Changes" : mode === "payment" ? "Record Payment" : mode === "transaction" ? "Record Transaction" : "Save"}</Button></div>}>
        {mode === "payment" && config.invoice ? (
          <form id="finance-record-form" className="finance-form" noValidate onSubmit={saveForm}>
            <p className="finance-inline-note">Outstanding balance: {display(form.balance)}</p>
            {renderField({ key: "amount", label: "Payment Amount", type: "number", required: true, min: "0.01", step: "0.01" }, form, updateField, errors, records)}
          </form>
        ) : mode === "payment" && config.readOnly ? (
          <form id="finance-record-form" className="finance-form" noValidate onSubmit={saveForm}>
            {paymentFields.map((field) => renderField({ ...field, label: field.key === "party" ? config.slug === "receivables" ? "Customer" : "Supplier" : field.label }, form, updateField, errors, records))}
          </form>
        ) : (
          <form id="finance-record-form" className="finance-form" noValidate onSubmit={saveForm}>
            {formFields?.map((field) => renderField(field, form, updateField, errors, records))}
            {config.invoice && <InvoiceLines form={form} setForm={setForm} error={errors.lineItems} />}
          </form>
        )}
      </Modal>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detailTitle(detail, config)} size="medium" footer={<div className="finance-form-actions"><Button variant="secondary" onClick={() => setDetail(null)}>Close</Button></div>}>
        {detail && <div className="finance-detail-grid">{Object.entries(detail).filter(([key]) => key !== "id" && key !== "lineItems" && key !== "detailAction").map(([key, value]) => <div key={key}><span>{humanize(key)}</span><strong>{display(value)}</strong></div>)}{detail.lineItems?.map((line, index) => <div className="finance-detail-line" key={`${line.description}-${index}`}><span>{line.description}</span><strong>{lineTotal(line)}</strong></div>)}{detail.detailAction === "source" && <p className="finance-inline-note">The source record is not connected yet.</p>}</div>}
      </Modal>

      <ConfirmModal open={Boolean(confirmation)} onClose={() => !confirmLoading && setConfirmation(null)} title={confirmation?.title} description={confirmation?.message} confirmLabel={confirmation?.label} onConfirm={confirmAction} loading={confirmLoading} variant={confirmation?.action === "cancel" ? "danger" : "warning"} />
    </main>
  );
}

function renderField(field, values, onChange, errors, accounts, compact = true) {
  const value = values[field.key] ?? "";
  const options = fieldOptions(field, accounts);
  return <label className={`finance-field ${field.type === "textarea" ? "finance-field--wide" : ""}`} key={field.key}><span>{field.label}{field.required && <i aria-hidden="true"> *</i>}</span>
    {field.type === "select" || field.type === "accountSelect" ? <select value={value} onChange={(event) => onChange(field.key, event.target.value)} aria-invalid={Boolean(errors[field.key])} aria-required={field.required}><option value="">Select {field.label.toLowerCase()}</option>{options.map((option) => <option value={option} key={option}>{option}</option>)}</select>
      : field.type === "textarea" ? <textarea value={value} onChange={(event) => onChange(field.key, event.target.value)} aria-invalid={Boolean(errors[field.key])} rows={3} />
        : <input type={field.type === "file" ? "file" : field.type} value={field.type === "file" ? undefined : value} onChange={(event) => onChange(field.key, field.type === "file" ? event.target.files?.[0] || null : event.target.value)} min={field.min} step={field.step} aria-invalid={Boolean(errors[field.key])} aria-required={field.required} />}
    {errors[field.key] && <small className="finance-field-error">{errors[field.key]}</small>}
    {field.type === "accountSelect" && options.length === 0 && <small className="finance-inline-help">Add and activate a cash or bank account before recording a transaction.</small>}
  </label>;
}

function InvoiceLines({ form, setForm, error }) {
  const lines = form.lineItems || [];
  function change(index, key, value) {
    setForm((current) => ({ ...current, lineItems: current.lineItems.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line) }));
  }
  return <section className="finance-lines"><div className="finance-lines__header"><h3>Line Items</h3><Button type="button" variant="secondary" size="small" icon={Plus} onClick={() => setForm((current) => ({ ...current, lineItems: [...current.lineItems, { description: "", quantity: "", unitPrice: "", tax: "", discount: "" }] }))}>Add line</Button></div>
    {error && <p className="finance-field-error">{error}</p>}
    {lines.map((line, index) => <div className="finance-line-item" key={index}>
      {[["description", "Description", "text"], ["quantity", "Quantity", "number"], ["unitPrice", "Unit Price", "number"], ["tax", "Tax", "number"], ["discount", "Discount", "number"]].map(([key, label, type]) => <label className={key === "description" ? "finance-line-item__description" : ""} key={key}><span>{label}</span><input aria-label={`${label} for line ${index + 1}`} type={type} min={key === "quantity" ? "0.01" : "0"} step={type === "number" ? "0.01" : undefined} value={line[key]} onChange={(event) => change(index, key, event.target.value)} /></label>)}
      <div className="finance-line-item__total"><span>Line Total</span><strong>{display(lineTotal(line))}</strong></div>
      <button type="button" className="finance-remove-line" aria-label={`Remove line ${index + 1}`} disabled={lines.length === 1} onClick={() => setForm((current) => ({ ...current, lineItems: current.lineItems.filter((_, lineIndex) => lineIndex !== index) }))}><X size={15} /></button>
    </div>)}
    <div className="finance-lines__total"><span>Calculated total</span><strong>{display(invoiceTotal(form))}</strong></div>
  </section>;
}

function formTitle(config, mode) {
  if (mode === "edit") return `Edit ${config.recordName || "record"}`;
  if (mode === "payment") return config.invoice ? "Record Invoice Payment" : "Record Payment";
  if (mode === "transaction") return "Record Cash/Bank Transaction";
  return config.addLabel || "Create Record";
}

function fieldLabel(fields, key) {
  return fields.find((field) => field.key === key)?.label || humanize(key);
}

function humanize(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase());
}

function detailTitle(detail, config) {
  if (!detail) return "Record details";
  const name = detail.name || detail.customer || detail.supplier || detail.number || detail.reference || detail.code || config.recordName || "Record";
  return detail.detailAction === "source" ? `Source: ${name}` : `${name} details`;
}
