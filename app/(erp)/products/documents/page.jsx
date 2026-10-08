"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  ChevronDown,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileText,
  FolderOpen,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Upload,
} from "lucide-react";

import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

import "./Documents.css";

const DOCUMENT_TYPES = [
  {
    id: "technical-sheet",
    title: "Technical Sheet",
    description:
      "Product specifications, measurements, construction details and technical requirements.",
    icon: FileText,
    formats: ["PDF", "DOC", "DOCX"],
  },
  {
    id: "certificate",
    title: "Certificate",
    description:
      "Material, quality, sustainability and certification documents associated with a product.",
    icon: Award,
    formats: ["PDF", "JPG", "PNG"],
  },
  {
    id: "compliance",
    title: "Compliance Document",
    description:
      "Regulatory, customer compliance and product conformity documentation.",
    icon: ShieldCheck,
    formats: ["PDF", "DOC", "DOCX"],
  },
  {
    id: "test-report",
    title: "Test Report",
    description:
      "Laboratory reports, performance tests and quality verification records.",
    icon: ClipboardCheck,
    formats: ["PDF", "XLS", "XLSX"],
  },
  {
    id: "supplier-document",
    title: "Supplier Document",
    description:
      "Supplier specifications, declarations, catalogues and supporting documentation.",
    icon: FolderOpen,
    formats: ["PDF", "DOC", "DOCX", "XLS", "XLSX"],
  },
  {
    id: "specification",
    title: "Specification",
    description:
      "Detailed product specifications and customer-specific requirements.",
    icon: FileCheck2,
    formats: ["PDF", "DOC", "DOCX"],
  },
];

const DOCUMENT_STATUS = [
  "All Status",
  "Active",
  "Pending Review",
  "Expired",
  "Archived",
];

const DOCUMENT_CATEGORIES = [
  "All Types",
  "Technical Sheet",
  "Certificate",
  "Compliance Document",
  "Test Report",
  "Supplier Document",
  "Specification",
];

const ACCEPTED_FILES =
  ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png";

export default function ProductDocumentsPage() {
  const fileInputRef = useRef(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] =
    useState("All Status");
  const [category, setCategory] =
    useState("All Types");
  const [showFilters, setShowFilters] =
    useState(false);
  const [selectedFiles, setSelectedFiles] =
    useState([]);

  const filteredTypes = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return DOCUMENT_TYPES;
    }

    return DOCUMENT_TYPES.filter((item) => {
      return (
        item.title.toLowerCase().includes(query) ||
        item.description
          .toLowerCase()
          .includes(query) ||
        item.formats.some((format) =>
          format.toLowerCase().includes(query)
        )
      );
    });
  }, [search]);

  function clearFilters() {
    setSearch("");
    setStatus("All Status");
    setCategory("All Types");
  }

  function handleFiles(event) {
    const files = Array.from(
      event.target.files || []
    );

    setSelectedFiles(files);

    event.target.value = "";
  }

  return (
    <div className="documents-page">
      <PageHeader
        eyebrow="Product Master"
        title="Documents"
        description="Manage technical, compliance, certification and supporting product documentation."
        action={
          <div className="documents-page__header-actions">
            <Link href="/products">
              <Button
                variant="secondary"
                icon={ArrowLeft}
              >
                Products
              </Button>
            </Link>

            <Button
              icon={Upload}
              onClick={() =>
                fileInputRef.current?.click()
              }
            >
              Upload Document
            </Button>
          </div>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_FILES}
        className="documents-hidden-input"
        onChange={handleFiles}
      />

      <div className="documents-notice">
        <div className="documents-notice__icon">
          <Settings2
            size={17}
            strokeWidth={1.8}
          />
        </div>

        <div className="documents-notice__content">
          <strong>
            Document storage is waiting for the backend
          </strong>

          <p>
            The document management interface is ready.
            Uploaded files, product associations, versions,
            permissions and storage locations will be persisted
            after backend integration.
          </p>
        </div>

        <Badge variant="success">
          Frontend Ready
        </Badge>
      </div>

      <section className="documents-stats">
        <Card className="documents-stat">
          <span>Total Documents</span>
          <strong>0</strong>
          <small>
            No documents uploaded
          </small>
        </Card>

        <Card className="documents-stat">
          <span>Certificates</span>
          <strong>0</strong>
          <small>
            Certification records
          </small>
        </Card>

        <Card className="documents-stat">
          <span>Compliance</span>
          <strong>0</strong>
          <small>
            Compliance documents
          </small>
        </Card>

        <Card className="documents-stat">
          <span>Pending Review</span>
          <strong>0</strong>
          <small>
            Awaiting verification
          </small>
        </Card>
      </section>

      {selectedFiles.length > 0 && (
        <Card
          className="documents-upload-preview"
          padding={false}
        >
          <div className="documents-upload-preview__header">
            <div>
              <span>
                Selected Files
              </span>

              <strong>
                {selectedFiles.length} file
                {selectedFiles.length === 1
                  ? ""
                  : "s"} ready for upload
              </strong>
            </div>

            <Badge variant="warning">
              Not Uploaded
            </Badge>
          </div>

          <div className="documents-upload-preview__list">
            {selectedFiles.map((file) => (
              <div
                className="documents-upload-file"
                key={`${file.name}-${file.size}`}
              >
                <FileText
                  size={17}
                  strokeWidth={1.8}
                />

                <div>
                  <strong>
                    {file.name}
                  </strong>

                  <span>
                    {formatFileSize(file.size)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="documents-upload-preview__footer">
            <span>
              File upload will become persistent when
              storage and API services are connected.
            </span>

            <Button
              variant="ghost"
              onClick={() =>
                setSelectedFiles([])
              }
            >
              Clear Selection
            </Button>
          </div>
        </Card>
      )}

      <Card
        className="documents-toolbar-card"
        padding={false}
      >
        <div className="documents-toolbar">
          <div className="documents-search">
            <Search
              size={17}
              strokeWidth={1.8}
            />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search document type..."
              aria-label="Search documents"
            />
          </div>

          <div className="documents-toolbar__filters">
            <div className="documents-select">
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value)
                }
                aria-label="Filter by document type"
              >
                {DOCUMENT_CATEGORIES.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  )
                )}
              </select>

              <ChevronDown size={15} />
            </div>

            <div className="documents-select">
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
                aria-label="Filter by document status"
              >
                {DOCUMENT_STATUS.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  )
                )}
              </select>

              <ChevronDown size={15} />
            </div>

            <Button
              variant={
                showFilters
                  ? "secondary"
                  : "ghost"
              }
              onClick={() =>
                setShowFilters(
                  (current) => !current
                )
              }
            >
              <Settings2 size={16} />
              Filters
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="documents-advanced-filters">
            <div className="documents-filter-info">
              <FileCheck2 size={16} />

              <span>
                Product, supplier, expiry date, version and
                verification filters will become available
                with backend data.
              </span>
            </div>

            <Button
              variant="ghost"
              onClick={clearFilters}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </Card>

      <Card
        className="documents-types-card"
        title="Document Configuration"
        description="Document structures available to the product master."
        padding={false}
      >
        <div className="documents-types-header">
          <div>
            <span>
              Supported Document Types
            </span>

            <strong>
              {filteredTypes.length} document types
            </strong>
          </div>

          <Badge variant="success">
            Structure Ready
          </Badge>
        </div>

        <div className="documents-types-grid">
          {filteredTypes.map((item) => {
            const Icon = item.icon;

            return (
              <article
                className="document-type"
                key={item.id}
              >
                <div className="document-type__top">
                  <div className="document-type__icon">
                    <Icon
                      size={20}
                      strokeWidth={1.8}
                    />
                  </div>

                  <Badge variant="success">
                    Active
                  </Badge>
                </div>

                <div className="document-type__body">
                  <div className="document-type__title">
                    <h3>
                      {item.title}
                    </h3>

                    <ArrowUpRight
                      size={16}
                      strokeWidth={1.8}
                    />
                  </div>

                  <p>
                    {item.description}
                  </p>
                </div>

                <div className="document-type__formats">
                  <span>
                    Supported formats
                  </span>

                  <div>
                    {item.formats.map(
                      (format) => (
                        <span key={format}>
                          {format}
                        </span>
                      )
                    )}
                  </div>
                </div>

                <div className="document-type__footer">
                  <span>
                    Documents
                  </span>

                  <strong>0</strong>
                </div>
              </article>
            );
          })}

          {filteredTypes.length === 0 && (
            <div className="documents-empty">
              <Search size={21} />

              <h3>
                No document type found
              </h3>

              <p>
                Try another search term.
              </p>

              <Button
                variant="secondary"
                onClick={clearFilters}
              >
                Clear Search
              </Button>
            </div>
          )}
        </div>
      </Card>

      <section className="documents-workflow">
        <div className="documents-section-heading">
          <span>
            Document Lifecycle
          </span>

          <h2>
            Product Documentation Flow
          </h2>

          <p>
            Documents will be linked to products and variants,
            versioned, reviewed and retained throughout the
            product lifecycle.
          </p>
        </div>

        <div className="documents-workflow-grid">
          <div className="documents-workflow-step">
            <span>01</span>

            <div>
              <strong>
                Upload
              </strong>

              <p>
                Add technical and supporting files.
              </p>
            </div>
          </div>

          <div className="documents-workflow-arrow">
            <ArrowUpRight size={17} />
          </div>

          <div className="documents-workflow-step">
            <span>02</span>

            <div>
              <strong>
                Associate
              </strong>

              <p>
                Link documents to products or variants.
              </p>
            </div>
          </div>

          <div className="documents-workflow-arrow">
            <ArrowUpRight size={17} />
          </div>

          <div className="documents-workflow-step">
            <span>03</span>

            <div>
              <strong>
                Review
              </strong>

              <p>
                Verify certificates and compliance records.
              </p>
            </div>
          </div>

          <div className="documents-workflow-arrow">
            <ArrowUpRight size={17} />
          </div>

          <div className="documents-workflow-step">
            <span>04</span>

            <div>
              <strong>
                Version
              </strong>

              <p>
                Maintain document history and expiry.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function formatFileSize(bytes) {
  if (!bytes) {
    return "0 KB";
  }

  const megabytes = bytes / (1024 * 1024);

  if (megabytes >= 1) {
    return `${megabytes.toFixed(2)} MB`;
  }

  return `${Math.max(
    1,
    Math.round(bytes / 1024)
  )} KB`;
}