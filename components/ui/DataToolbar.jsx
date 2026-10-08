"use client";

import {
  Download,
  Filter,
  MoreHorizontal,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import Button from "./Button";
import Input from "./Input";
import Dropdown, {
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
} from "./Dropdown";

export default function DataToolbar({
  search = "",
  onSearchChange,

  searchPlaceholder = "Search...",
  showSearch = true,

  filters = [],
  activeFilterCount = 0,
  onFilterClick,

  viewOptions = [],
  activeView,
  onViewChange,

  columns = [],
  onColumnChange,

  onExport,
  exportLabel = "Export",

  onRefresh,
  refreshing = false,

  actions,

  bulkActions,
  selectedCount = 0,

  moreActions,

  children,

  compact = false,
  className = "",
}) {
  const hasFilters =
    filters.length > 0;

  const hasBulkActions =
    selectedCount > 0 &&
    bulkActions?.length > 0;

  const hasViewOptions =
    viewOptions.length > 0;

  const hasColumnOptions =
    columns.length > 0;

  return (
    <div
      className={[
        "erp-data-toolbar",
        compact
          ? "erp-data-toolbar--compact"
          : "",
        hasBulkActions
          ? "erp-data-toolbar--selection"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="erp-data-toolbar__main">
        {showSearch && (
          <div className="erp-data-toolbar__search">
            <Input
              type="search"
              value={search}
              onChange={(event) =>
                onSearchChange?.(
                  event.target.value
                )
              }
              placeholder={
                searchPlaceholder
              }
              icon={Search}
              clearable
              onClear={() =>
                onSearchChange?.("")
              }
            />
          </div>
        )}

        {hasFilters && (
          <Button
            variant={
              activeFilterCount > 0
                ? "soft"
                : "secondary"
            }
            size="medium"
            icon={Filter}
            onClick={onFilterClick}
          >
            Filters
            {activeFilterCount > 0 && (
              <span className="erp-data-toolbar__count">
                {activeFilterCount}
              </span>
            )}
          </Button>
        )}

        {children}
      </div>

      <div className="erp-data-toolbar__right">
        {hasViewOptions && (
          <Dropdown
            placement="bottom-end"
            width={210}
            trigger={
              <Button
                variant="secondary"
                size="medium"
                icon={SlidersHorizontal}
              >
                View
              </Button>
            }
          >
            <DropdownLabel>
              Saved Views
            </DropdownLabel>

            {viewOptions.map((view) => (
              <DropdownItem
                key={view.value}
                label={view.label}
                description={
                  view.description
                }
                selected={
                  activeView ===
                  view.value
                }
                disabled={
                  view.disabled
                }
                onClick={() =>
                  onViewChange?.(
                    view.value
                  )
                }
              />
            ))}
          </Dropdown>
        )}

        {hasColumnOptions && (
          <Dropdown
            placement="bottom-end"
            width={240}
            trigger={
              <Button
                variant="secondary"
                size="medium"
                icon={SlidersHorizontal}
              >
                Columns
              </Button>
            }
          >
            <DropdownLabel>
              Table Columns
            </DropdownLabel>

            {columns.map((column) => (
              <DropdownItem
                key={column.key}
                label={column.label}
                selected={
                  column.visible !== false
                }
                disabled={
                  column.disabled
                }
                onClick={() =>
                  onColumnChange?.(
                    column.key,
                    !column.visible
                  )
                }
              />
            ))}
          </Dropdown>
        )}

        {onExport && (
          <Button
            variant="secondary"
            size="medium"
            icon={Download}
            onClick={onExport}
          >
            {exportLabel}
          </Button>
        )}

        {onRefresh && (
          <Button
            variant="secondary"
            size="medium"
            icon={RefreshCw}
            loading={refreshing}
            onClick={onRefresh}
            aria-label="Refresh data"
          >
            <span className="erp-data-toolbar__refresh-label">
              Refresh
            </span>
          </Button>
        )}

        {moreActions?.length > 0 && (
          <Dropdown
            placement="bottom-end"
            width={220}
            trigger={
              <Button
                variant="secondary"
                size="icon"
                icon={MoreHorizontal}
                aria-label="More actions"
              />
            }
          >
            {moreActions.map(
              (action, index) => (
                <div
                  key={
                    action.id ||
                    action.label ||
                    index
                  }
                >
                  {action.divider && (
                    <DropdownDivider />
                  )}

                  {action.label && (
                    <DropdownItem
                      label={
                        action.label
                      }
                      description={
                        action.description
                      }
                      icon={
                        action.icon
                      }
                      danger={
                        action.danger
                      }
                      disabled={
                        action.disabled
                      }
                      onClick={
                        action.onClick
                      }
                    />
                  )}
                </div>
              )
            )}
          </Dropdown>
        )}
      </div>

      {hasBulkActions && (
        <div className="erp-data-toolbar__bulk">
          <div className="erp-data-toolbar__selection">
            <strong>
              {selectedCount}
            </strong>

            <span>
              selected
            </span>
          </div>

          <div className="erp-data-toolbar__bulk-actions">
            {bulkActions.map(
              (action, index) => (
                <Button
                  key={
                    action.id ||
                    action.label ||
                    index
                  }
                  variant={
                    action.variant ||
                    (action.danger
                      ? "danger-outline"
                      : "secondary")
                  }
                  size="small"
                  icon={action.icon}
                  disabled={
                    action.disabled
                  }
                  loading={
                    action.loading
                  }
                  onClick={
                    action.onClick
                  }
                >
                  {action.label}
                </Button>
              )
            )}
          </div>

          <button
            type="button"
            className="erp-data-toolbar__clear"
            onClick={() =>
              onSearchChange?.(
                search
              )
            }
            aria-label="Clear selection"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}