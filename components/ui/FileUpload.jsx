"use client";

import { useId, useRef, useState } from "react";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileArchive,
  File,
  X,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

import "./FileUpload.css";

const DEFAULT_ACCEPT = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
];

function formatFileSize(bytes) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${
    units[index] || "GB"
  }`;
}

function getFileIcon(file) {
  const name = file?.name?.toLowerCase() || "";
  const type = file?.type || "";

  if (type.startsWith("image/")) return ImageIcon;
  if (
    type.includes("spreadsheet") ||
    type.includes("excel") ||
    /\.(xls|xlsx|csv)$/.test(name)
  ) {
    return FileSpreadsheet;
  }

  if (
    type.includes("zip") ||
    type.includes("rar") ||
    /\.(zip|rar|7z)$/.test(name)
  ) {
    return FileArchive;
  }

  if (
    type.includes("pdf") ||
    type.includes("document") ||
    /\.(pdf|doc|docx)$/.test(name)
  ) {
    return FileText;
  }

  return File;
}

function normalizeAccept(accept) {
  if (!accept) return DEFAULT_ACCEPT;

  if (Array.isArray(accept)) return accept;

  return accept
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isAcceptedFile(file, accept) {
  if (!accept?.length) return true;

  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  return accept.some((rule) => {
    const normalized = rule.toLowerCase();

    if (normalized === "*/*") return true;

    if (normalized.endsWith("/*")) {
      return fileType.startsWith(normalized.slice(0, -1));
    }

    if (normalized.startsWith(".")) {
      return fileName.endsWith(normalized);
    }

    return fileType === normalized;
  });
}

function createFileItem(file) {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()
      .toString(36)
      .slice(2)}`,
    file,
    status: "ready",
    progress: 0,
    error: "",
  };
}

export default function FileUpload({
  value,
  defaultValue = [],
  onChange,

  label,
  description,
  hint,
  error,
  success,
  required = false,

  accept = DEFAULT_ACCEPT,
  maxSize = 10 * 1024 * 1024,
  maxFiles = 10,

  disabled = false,
  multiple = true,

  dragAndDrop = true,
  showFileList = true,
  showProgress = true,
  showSize = true,

  compact = false,
  variant = "default",

  onUpload,
  onRemove,
  onRetry,

  className = "",
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const isControlled = value !== undefined;

  const [internalFiles, setInternalFiles] = useState(() =>
    Array.isArray(defaultValue)
      ? defaultValue.map((item) =>
          item?.file ? item : createFileItem(item)
        )
      : []
  );

  const files = isControlled ? value || [] : internalFiles;

  const acceptedTypes = normalizeAccept(accept);

  function updateFiles(nextFiles) {
    if (!isControlled) {
      setInternalFiles(nextFiles);
    }

    onChange?.(nextFiles);
  }

  function validateFile(file) {
    if (!isAcceptedFile(file, acceptedTypes)) {
      return `File type is not supported.`;
    }

    if (maxSize && file.size > maxSize) {
      return `File exceeds the ${formatFileSize(maxSize)} limit.`;
    }

    return "";
  }

  function addFiles(fileList) {
    if (disabled) return;

    let incoming = Array.from(fileList || []);

    if (!multiple) {
      incoming = incoming.slice(0, 1);
    }

    const availableSlots = Math.max(0, maxFiles - files.length);

    incoming = incoming.slice(0, availableSlots);

    const newItems = incoming.map((file) => {
      const validationError = validateFile(file);

      return {
        ...createFileItem(file),
        status: validationError ? "error" : "ready",
        error: validationError,
      };
    });

    if (!newItems.length) return;

    const nextFiles = multiple
      ? [...files, ...newItems]
      : newItems;

    updateFiles(nextFiles);

    if (onUpload) {
      newItems.forEach((item) => {
        if (item.status !== "error") {
          onUpload(item.file, item);
        }
      });
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleInputChange(event) {
    addFiles(event.target.files);
  }

  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    setDragActive(false);

    if (disabled) return;

    addFiles(event.dataTransfer.files);
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!disabled && dragAndDrop) {
      setDragActive(true);
    }
  }

  function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();

    setDragActive(false);
  }

  function removeFile(id) {
    const item = files.find((file) => file.id === id);

    const nextFiles = files.filter((file) => file.id !== id);

    updateFiles(nextFiles);

    if (item) {
      onRemove?.(item.file, item);
    }
  }

  function retryFile(item) {
    const nextFiles = files.map((file) =>
      file.id === item.id
        ? {
            ...file,
            status: "ready",
            error: "",
            progress: 0,
          }
        : file
    );

    updateFiles(nextFiles);

    onRetry?.(item.file, item);
  }

  function openPicker() {
    if (!disabled) {
      inputRef.current?.click();
    }
  }

  const rootClass = [
    "af-file-upload",
    compact && "af-file-upload--compact",
    variant !== "default" && `af-file-upload--${variant}`,
    disabled && "af-file-upload--disabled",
    error && "af-file-upload--error",
    success && "af-file-upload--success",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      {label && (
        <div className="af-file-upload__label-row">
          <label
            htmlFor={inputId}
            className="af-file-upload__label"
          >
            {label}

            {required && (
              <span className="af-file-upload__required">
                *
              </span>
            )}
          </label>

          {maxFiles > 1 && (
            <span className="af-file-upload__count">
              {files.length}/{maxFiles}
            </span>
          )}
        </div>
      )}

      {description && (
        <div className="af-file-upload__description">
          {description}
        </div>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="af-file-upload__input"
        accept={acceptedTypes.join(",")}
        multiple={multiple}
        disabled={disabled}
        onChange={handleInputChange}
      />

      <div
        className={[
          "af-file-upload__dropzone",
          dragActive && "is-dragging",
        ]
          .filter(Boolean)
          .join(" ")}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            openPicker();
          }
        }}
        onClick={openPicker}
        aria-disabled={disabled}
      >
        <div className="af-file-upload__icon">
          <Upload size={20} strokeWidth={1.8} />
        </div>

        <div className="af-file-upload__content">
          <div className="af-file-upload__title">
            {dragActive
              ? "Drop files here"
              : "Upload files"}
          </div>

          <div className="af-file-upload__subtitle">
            {dragAndDrop
              ? "Drag and drop files here or"
              : "Choose files from your device"}
          </div>

          <button
            type="button"
            className="af-file-upload__browse"
            onClick={(event) => {
              event.stopPropagation();
              openPicker();
            }}
            disabled={disabled}
          >
            Browse files
          </button>
        </div>
      </div>

      <div className="af-file-upload__meta">
        <span>
          {acceptedTypes.length
            ? acceptedTypes.join(", ")
            : "All file types"}
        </span>

        {maxSize && (
          <span>
            Max {formatFileSize(maxSize)}
          </span>
        )}
      </div>

      {error && (
        <div className="af-file-upload__message af-file-upload__message--error">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="af-file-upload__message af-file-upload__message--success">
          <CheckCircle2 size={15} />
          <span>{success}</span>
        </div>
      )}

      {hint && !error && !success && (
        <div className="af-file-upload__hint">
          {hint}
        </div>
      )}

      {showFileList && files.length > 0 && (
        <div className="af-file-upload__list">
          {files.map((item) => {
            const Icon = getFileIcon(item.file);

            return (
              <div
                key={item.id}
                className={`af-file-upload__file ${
                  item.status === "error"
                    ? "af-file-upload__file--error"
                    : ""
                }`}
              >
                <div className="af-file-upload__file-icon">
                  <Icon size={18} strokeWidth={1.8} />
                </div>

                <div className="af-file-upload__file-info">
                  <div className="af-file-upload__file-name">
                    {item.file.name}
                  </div>

                  {showSize && (
                    <div className="af-file-upload__file-meta">
                      {formatFileSize(item.file.size)}

                      {item.status === "error" && (
                        <span className="af-file-upload__file-error">
                          {item.error}
                        </span>
                      )}
                    </div>
                  )}

                  {showProgress &&
                    item.status === "uploading" && (
                      <div className="af-file-upload__progress">
                        <div
                          className="af-file-upload__progress-bar"
                          style={{
                            width: `${item.progress || 0}%`,
                          }}
                        />
                      </div>
                    )}
                </div>

                <div className="af-file-upload__file-actions">
                  {item.status === "error" ? (
                    <button
                      type="button"
                      className="af-file-upload__file-button"
                      onClick={() => retryFile(item)}
                      aria-label={`Retry ${item.file.name}`}
                    >
                      <RotateCcw size={16} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="af-file-upload__file-button"
                      onClick={() => removeFile(item.id)}
                      aria-label={`Remove ${item.file.name}`}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}