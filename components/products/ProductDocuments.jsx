"use client";

import { useRef, useState } from "react";
import {
  FileText,
  Upload,
  X,
  Download,
} from "lucide-react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";

import "./ProductDocuments.css";

const DOCUMENT_TYPES = [
  {
    value: "technical-sheet",
    label: "Technical Sheet",
  },
  {
    value: "certificate",
    label: "Certificate",
  },
  {
    value: "compliance",
    label: "Compliance Document",
  },
  {
    value: "test-report",
    label: "Test Report",
  },
  {
    value: "supplier-document",
    label: "Supplier Document",
  },
  {
    value: "care-instructions",
    label: "Care Instructions",
  },
  {
    value: "specification",
    label: "Specification",
  },
  {
    value: "other",
    label: "Other",
  },
];

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function ProductDocuments({
  documents = [],
  onChange,
}) {
  const inputRef = useRef(null);

  const [documentType, setDocumentType] =
    useState("technical-sheet");

  const [dragActive, setDragActive] =
    useState(false);

  const [error, setError] = useState("");

  function createDocumentId() {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }

    return `document-${Date.now()}-${documents.length}`;
  }

  function processFiles(fileList) {
    const files = Array.from(fileList || []);

    if (!files.length) return;

    setError("");

    const validFiles = [];
    const invalidFiles = [];

    files.forEach((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        invalidFiles.push(file.name);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        invalidFiles.push(file.name);
        return;
      }

      validFiles.push(file);
    });

    if (invalidFiles.length) {
      setError(
        `${invalidFiles.length} file${
          invalidFiles.length === 1
            ? ""
            : "s"
        } could not be added. Supported files are PDF, DOC, DOCX, XLS, XLSX, JPG and PNG up to 10 MB.`
      );
    }

    if (!validFiles.length) return;

    const newDocuments = validFiles.map(
      (file) => ({
        id: createDocumentId(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        category: documentType,
        preview: URL.createObjectURL(file),
      })
    );

    onChange?.([
      ...documents,
      ...newDocuments,
    ]);
  }

  function handleInputChange(event) {
    processFiles(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);

    processFiles(event.dataTransfer.files);
  }

  function handleDragOver(event) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    setDragActive(false);
  }

  function removeDocument(documentId) {
    const document = documents.find(
      (item) => item.id === documentId
    );

    if (document?.preview) {
      URL.revokeObjectURL(
        document.preview
      );
    }

    onChange?.(
      documents.filter(
        (item) => item.id !== documentId
      )
    );
  }

  function formatFileSize(bytes) {
    if (!bytes) return "0 KB";

    if (bytes < 1024 * 1024) {
      return `${Math.round(
        bytes / 1024
      )} KB`;
    }

    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  function getDocumentTypeLabel(value) {
    return (
      DOCUMENT_TYPES.find(
        (item) => item.value === value
      )?.label || "Other"
    );
  }

  function openDocument(document) {
    if (!document.preview) return;

    window.open(
      document.preview,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <div className="product-documents">
      <Card
        title="Product Documents"
        description="Attach technical, compliance and supporting documents to this product."
      >
        <div className="product-documents-upload-controls">
          <Select
            label="Document Type"
            options={DOCUMENT_TYPES}
            value={documentType}
            onChange={setDocumentType}
          />

          <div className="product-documents-upload-button">
            <span>
              Upload documents after selecting a document type.
            </span>

            <Button
              size="small"
              icon={Upload}
              onClick={() =>
                inputRef.current?.click()
              }
            >
              Choose Files
            </Button>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          multiple
          hidden
          onChange={handleInputChange}
        />

        <div
          className={`product-documents-dropzone ${
            dragActive
              ? "is-dragging"
              : ""
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() =>
            inputRef.current?.click()
          }
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" ||
              event.key === " "
            ) {
              inputRef.current?.click();
            }
          }}
        >
          <div className="product-documents-dropzone__icon">
            <FileText size={21} />
          </div>

          <strong>
            Drop documents here
          </strong>

          <span>
            or click to browse files
          </span>

          <small>
            PDF, DOC, DOCX, XLS, XLSX, JPG or PNG
            · Maximum 10 MB
          </small>
        </div>

        {error && (
          <div className="product-documents-error">
            {error}
          </div>
        )}
      </Card>

      <Card
        title="Uploaded Documents"
        description={`${documents.length} document${
          documents.length === 1
            ? ""
            : "s"
        } attached to this product.`}
      >
        {documents.length === 0 ? (
          <div className="product-documents-empty">
            <FileText size={22} />

            <strong>
              No documents uploaded
            </strong>

            <p>
              Product certificates, technical sheets,
              compliance files and other documents will
              appear here.
            </p>
          </div>
        ) : (
          <div className="product-documents-list">
            {documents.map((document) => (
              <div
                className="product-document-row"
                key={document.id}
              >
                <div className="product-document-row__icon">
                  <FileText size={18} />
                </div>

                <div className="product-document-row__info">
                  <strong
                    title={document.name}
                  >
                    {document.name}
                  </strong>

                  <span>
                    {getDocumentTypeLabel(
                      document.category
                    )}
                    {" · "}
                    {formatFileSize(
                      document.size
                    )}
                  </span>
                </div>

                <div className="product-document-row__actions">
                  <button
                    type="button"
                    title="Open document"
                    aria-label={`Open ${document.name}`}
                    onClick={() =>
                      openDocument(
                        document
                      )
                    }
                  >
                    <Download size={15} />
                  </button>

                  <button
                    type="button"
                    title="Remove document"
                    aria-label={`Remove ${document.name}`}
                    onClick={() =>
                      removeDocument(
                        document.id
                      )
                    }
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}