"use client";

import Link from "next/link";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import InventoryPager from "@/components/inventory/InventoryPager";
import ItemPicker from "@/components/inventory/ItemPicker";
import { apiRequest, downloadFile } from "@/lib/api/client";
import useCurrentUser from "@/lib/auth/useCurrentUser";
import useApiData, { toQuery } from "@/lib/inventory/useApiData";

import "@/components/inventory/InventoryWorkspace.css";

const TYPES = { SPECIFICATION: "Specification", DRAWING: "Drawing", TEST_REPORT: "Test report", CERTIFICATE: "Certificate", IMAGE: "Image", OTHER: "Other" };
const size = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function UploadDialog({ onClose, onSaved }) {
  const [item, setItem] = useState(null);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("SPECIFICATION");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (saving || !file || !item) return;
    if (file.size > 5 * 1024 * 1024) { setError("Files can be at most 5 MB."); return; }
    setSaving(true);
    setError("");
    const form = new FormData();
    form.set("productId", item.id);
    form.set("title", title);
    form.set("documentType", documentType);
    form.set("file", file);
    try {
      await apiRequest("/api/products/documents", { method: "POST", body: form });
      onSaved();
    } catch (cause) {
      setError(cause.message);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? undefined : onClose} title="Upload a document" description="PDF, PNG, JPEG, WebP, text or CSV, up to 5 MB. The file's contents must match its type." size="medium">
      <form className="inv-dialog" onSubmit={submit}>
        <ItemPicker label="Item" value={item} onChange={setItem} required />
        <div className="inv-dialog__grid">
          <div className="inv-field"><label htmlFor="pd-title">Title *</label><input id="pd-title" required minLength={2} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} /></div>
          <div className="inv-field"><label htmlFor="pd-type">Type *</label><select id="pd-type" value={documentType} onChange={(event) => setDocumentType(event.target.value)}>{Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        </div>
        <div className="inv-field"><label htmlFor="pd-file">File *</label><input id="pd-file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,application/pdf,image/png,image/jpeg,image/webp,text/plain,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></div>
        {error && <p className="inv-dialog__error" role="alert">{error}</p>}
        <div className="inv-dialog__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!file || !item}>Upload</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function DocumentsPage() {
  const { can } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const list = useApiData(`/api/products/documents${toQuery({ search, status, page, pageSize: 50 })}`);
  const rows = list.data?.documents ?? [];

  async function download(row) {
    setError("");
    try { await downloadFile(`/api/products/documents/${row.id}`, row.fileName); } catch (cause) { setError(cause.message); }
  }
  async function archive(row) {
    if (!window.confirm(`Archive "${row.title}"? It stays on record but is no longer listed as current.`)) return;
    setError("");
    try { await apiRequest(`/api/products/documents/${row.id}`, { method: "DELETE" }); list.reload(); } catch (cause) { setError(cause.message); }
  }

  return (
    <main className="inv-page">
      <header className="inv-header">
        <div>
          <p className="inv-header__eyebrow"><Link href="/products">Products</Link></p>
          <h1>Product documents</h1>
          <p>Specifications, drawings, test reports and certificates attached to items. Files are stored with a SHA-256 checksum and archived rather than deleted.</p>
        </div>
        <div className="inv-header__actions">{can("products:update") && <Button variant="primary" onClick={() => setUploading(true)}>Upload document</Button>}</div>
      </header>
      {error && <p className="inv-dialog__error" role="alert">{error}</p>}
      <section className="inv-card">
        <div className="inv-toolbar">
          <div className="inv-field"><label htmlFor="pd-search">Search</label><input id="pd-search" type="search" placeholder="Title, file name or SKU" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
          <div className="inv-field"><label htmlFor="pd-status">Status</label><select id="pd-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="ACTIVE">Current</option><option value="ARCHIVED">Archived</option><option value="">All</option></select></div>
        </div>
        {list.error ? <p className="inv-state inv-state--error" role="alert">{list.error}</p> : !list.data ? <p className="inv-state" role="status">Loading documents…</p> : rows.length === 0 ? <p className="inv-state">No documents{search ? " match" : " yet"}.</p> : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Document</th><th>Item</th><th>Type</th><th className="inv-num">Size</th><th>Uploaded</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Document"><button type="button" className="inv-link-button" onClick={() => download(row)}><strong>{row.title}</strong></button><small>{row.fileName}</small></td>
                    <td data-label="Item"><Link href={`/products/${row.productId}`}>{row.sku}</Link><small>{row.productName}</small></td>
                    <td data-label="Type">{TYPES[row.documentType]}</td>
                    <td data-label="Size" className="inv-num">{size(row.sizeBytes)}</td>
                    <td data-label="Uploaded">{row.uploadedAt.slice(0, 10)}<small>{row.uploadedBy}</small></td>
                    <td data-label="">
                      {["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"].includes(row.mimeType) && <a className="inv-link-button" href={`/api/products/documents/${row.id}?inline=1`} target="_blank" rel="noopener noreferrer">View</a>}
                      {row.status === "ACTIVE" && can("products:update") && <> · <button type="button" className="inv-link-button" onClick={() => archive(row)}>Archive</button></>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <InventoryPager page={page} hasMore={list.data?.hasMore} onChange={setPage} disabled={list.loading} />
      </section>
      {uploading && <UploadDialog onClose={() => setUploading(false)} onSaved={() => { setUploading(false); list.reload(); }} />}
    </main>
  );
}

