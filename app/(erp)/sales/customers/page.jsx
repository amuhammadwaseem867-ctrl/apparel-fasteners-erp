"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api/client";
import "./CustomerMaster.css";

const EMPTY_CUSTOMER = {
  code: "",
  name: "",
  email: "",
  phone: "",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_CUSTOMER);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadCustomers() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          search: search.trim(),
          page: "1",
          pageSize: "100",
        });

        const result = await apiRequest(`/api/customers?${params}`);

        if (active) {
          setCustomers(result.customers ?? []);
        }
      } catch (cause) {
        if (active) {
          setError(
            cause?.message || "Unable to load customers.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadCustomers();

    return () => {
      active = false;
    };
  }, [search, refresh]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submit(event) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await apiRequest("/api/customers", {
        method: "POST",
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        }),
      });

      setForm(EMPTY_CUSTOMER);
      setShowForm(false);
      setRefresh((current) => current + 1);
    } catch (cause) {
      setError(
        cause?.message || "Unable to create customer.",
      );
    } finally {
      setSaving(false);
    }
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setShowForm(false);
    setForm(EMPTY_CUSTOMER);
  }

  return (
    <main className="customer-master">
      <header className="customer-master__header">
        <div className="customer-master__heading">
          <p className="customer-master__eyebrow">
            SALES / CRM
          </p>

          <h1>Customers</h1>

          <span>
            Manage customer accounts used across sales orders
            and commercial activity.
          </span>
        </div>

        <button
          type="button"
          className="customer-master__primary"
          onClick={() =>
            setShowForm((current) => !current)
          }
        >
          {showForm ? "Close" : "+ Add customer"}
        </button>
      </header>

      {error && (
        <div
          className="customer-master__error"
          role="alert"
        >
          {error}
        </div>
      )}

      {showForm && (
        <form
          className="customer-master__form"
          onSubmit={submit}
        >
          <div className="customer-master__form-header">
            <div>
              <p>Customer master</p>
              <h2>New customer</h2>
            </div>

            <button
              type="button"
              className="customer-master__secondary"
              onClick={closeForm}
              disabled={saving}
            >
              Cancel
            </button>
          </div>

          <div className="customer-master__form-grid">
            <label>
              <span>Customer code *</span>

              <input
                required
                maxLength={80}
                value={form.code}
                onChange={(event) =>
                  updateField("code", event.target.value)
                }
                placeholder="e.g. CUST-001"
              />
            </label>

            <label>
              <span>Customer name *</span>

              <input
                required
                maxLength={180}
                value={form.name}
                onChange={(event) =>
                  updateField("name", event.target.value)
                }
                placeholder="Customer or company name"
              />
            </label>

            <label>
              <span>Email</span>

              <input
                type="email"
                maxLength={254}
                value={form.email}
                onChange={(event) =>
                  updateField("email", event.target.value)
                }
                placeholder="customer@example.com"
              />
            </label>

            <label>
              <span>Phone</span>

              <input
                maxLength={60}
                value={form.phone}
                onChange={(event) =>
                  updateField("phone", event.target.value)
                }
                placeholder="+92..."
              />
            </label>
          </div>

          <div className="customer-master__form-actions">
            <button
              type="submit"
              className="customer-master__primary"
              disabled={saving}
            >
              {saving ? "Saving..." : "Create customer"}
            </button>
          </div>
        </form>
      )}

      <section className="customer-master__toolbar">
        <label className="customer-master__search">
          <span>Search customers</span>

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search by name, code or email"
          />
        </label>

        <div className="customer-master__count">
          <strong>{customers.length}</strong>
          <span>
            {customers.length === 1
              ? "customer"
              : "customers"}
          </span>
        </div>
      </section>

      <section className="customer-master__panel">
        <div className="customer-master__scroll">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Customer</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan="5"
                    className="customer-master__message"
                  >
                    Loading customers...
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td
                    colSpan="5"
                    className="customer-master__message"
                  >
                    Unable to load customers.
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                customers.length === 0 && (
                  <tr>
                    <td
                      colSpan="5"
                      className="customer-master__message"
                    >
                      No customers found.
                    </td>
                  </tr>
                )}

              {!loading &&
                !error &&
                customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <strong>{customer.code}</strong>
                    </td>

                    <td>
                      <div className="customer-master__customer">
                        <strong>{customer.name}</strong>
                      </div>
                    </td>

                    <td>
                      {customer.email || "—"}
                    </td>

                    <td>
                      {customer.phone || "—"}
                    </td>

                    <td>
                      <span
                        className={`customer-master__status customer-master__status--${String(
                          customer.status || "UNKNOWN",
                        ).toLowerCase()}`}
                      >
                        {customer.status || "UNKNOWN"}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
