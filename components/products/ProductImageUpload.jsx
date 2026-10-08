"use client";

import { useRef, useState } from "react";
import {
  ImagePlus,
  Upload,
  X,
  Star,
} from "lucide-react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

import "./ProductImageUpload.css";

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function ProductImageUpload({
  images = [],
  onChange,
}) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");

  function createImageId() {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }

    return `image-${Date.now()}-${images.length}`;
  }

  function processFiles(fileList) {
    const files = Array.from(fileList || []);

    if (!files.length) return;

    setError("");

    const validFiles = [];
    const invalidFiles = [];

    files.forEach((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        invalidFiles.push(
          `${file.name}: unsupported format`
        );
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        invalidFiles.push(
          `${file.name}: file exceeds 5 MB`
        );
        return;
      }

      validFiles.push(file);
    });

    if (invalidFiles.length) {
      setError(
        `${invalidFiles.length} file${
          invalidFiles.length === 1 ? "" : "s"
        } could not be added. Use JPG, PNG or WEBP under 5 MB.`
      );
    }

    if (!validFiles.length) return;

    const newImages = validFiles.map((file) => ({
      id: createImageId(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      preview: URL.createObjectURL(file),
      primary: images.length === 0,
    }));

    onChange?.([
      ...images,
      ...newImages,
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

  function removeImage(imageId) {
    const image = images.find(
      (item) => item.id === imageId
    );

    if (image?.preview) {
      URL.revokeObjectURL(image.preview);
    }

    const remaining = images.filter(
      (item) => item.id !== imageId
    );

    if (
      image?.primary &&
      remaining.length > 0
    ) {
      remaining[0] = {
        ...remaining[0],
        primary: true,
      };
    }

    onChange?.(remaining);
  }

  function setPrimaryImage(imageId) {
    onChange?.(
      images.map((image) => ({
        ...image,
        primary: image.id === imageId,
      }))
    );
  }

  function formatFileSize(bytes) {
    if (!bytes) return "0 KB";

    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="product-image-upload">
      <Card
        title="Product Images"
        description="Upload clear product images for the product master and catalog."
        action={
          <Button
            size="small"
            icon={Upload}
            onClick={() =>
              inputRef.current?.click()
            }
          >
            Upload Images
          </Button>
        }
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={handleInputChange}
        />

        <div
          className={`product-image-upload__dropzone ${
            dragActive ? "is-dragging" : ""
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
          <div className="product-image-upload__dropzone-icon">
            <ImagePlus size={22} />
          </div>

          <strong>
            Drop product images here
          </strong>

          <span>
            or click to browse files
          </span>

          <small>
            JPG, PNG or WEBP · Maximum 5 MB per image
          </small>
        </div>

        {error && (
          <div className="product-image-upload__error">
            {error}
          </div>
        )}

        {images.length > 0 && (
          <div className="product-image-upload__list">
            {images.map((image) => (
              <div
                className={`product-image-card ${
                  image.primary
                    ? "is-primary"
                    : ""
                }`}
                key={image.id}
              >
                <div className="product-image-card__preview">
                  <img
                    src={image.preview}
                    alt={image.name}
                  />

                  {image.primary && (
                    <span className="product-image-card__primary">
                      <Star size={12} />
                      Primary
                    </span>
                  )}

                  <button
                    type="button"
                    className="product-image-card__remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeImage(image.id);
                    }}
                    aria-label={`Remove ${image.name}`}
                    title="Remove image"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="product-image-card__info">
                  <strong title={image.name}>
                    {image.name}
                  </strong>

                  <span>
                    {formatFileSize(image.size)}
                  </span>
                </div>

                {!image.primary && (
                  <button
                    type="button"
                    className="product-image-card__primary-action"
                    onClick={() =>
                      setPrimaryImage(image.id)
                    }
                  >
                    Set as Primary
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {images.length === 0 && (
          <div className="product-image-upload__empty">
            No product images uploaded yet.
          </div>
        )}
      </Card>
    </div>
  );
}