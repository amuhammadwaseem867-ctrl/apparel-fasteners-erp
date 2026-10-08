const accountTypes = [
  "Assets",
  "Liabilities",
  "Equity",
  "Revenue",
  "Expenses",
  "Cost of Goods Sold",
];

const paymentMethods = [
  "Cash",
  "Bank Transfer",
  "Card",
  "Cheque",
  "Other",
];

const statuses = ["Draft", "Recorded", "Cancelled"];
const dateFilters = [
  { key: "fromDate", label: "From date", type: "date" },
  { key: "toDate", label: "To date", type: "date" },
];

const selectField = (key, label, options, required = false) => ({
  key,
  label,
  type: "select",
  options,
  required,
});

const textField = (key, label, required = false, extra = {}) => ({
  key,
  label,
  type: "text",
  required,
  ...extra,
});

const amountField = (key, label, required = false) => ({
  key,
  label,
  type: "number",
  required,
  min: "0",
  step: "0.01",
});

export const accountsConfig = {
  slug: "accounts",
  title: "Accounts",
  description: "Manage the company's chart of accounts and account structure.",
  emptyTitle: "No accounts configured",
  addLabel: "Add Account",
  recordName: "account",
  columns: [
    ["code", "Account Code"],
    ["name", "Account Name"],
    ["type", "Account Type"],
    ["parent", "Parent Account"],
    ["openingBalance", "Opening Balance"],
    ["currentBalance", "Current Balance"],
    ["status", "Status"],
  ],
  fields: [
    textField("code", "Account Code", true),
    textField("name", "Account Name", true),
    selectField("type", "Account Type", accountTypes, true),
    textField("parent", "Parent Account"),
    amountField("openingBalance", "Opening Balance"),
    { key: "description", label: "Description", type: "textarea" },
    selectField("status", "Status", ["Active", "Inactive"], true),
  ],
  filters: [
    selectField("type", "Account Type", accountTypes),
    selectField("status", "Status", ["Active", "Inactive"]),
  ],
  searchKeys: ["code", "name", "type", "parent"],
  actions: ["view", "edit", "toggle"],
};

export const incomeConfig = {
  slug: "income",
  title: "Income",
  description: "Track income received from customers and other business sources.",
  emptyTitle: "No income records available",
  addLabel: "Record Income",
  recordName: "income",
  columns: [
    ["reference", "Reference"], ["date", "Date"], ["customer", "Customer"],
    ["incomeType", "Income Type"], ["account", "Account"],
    ["paymentMethod", "Payment Method"], ["amount", "Amount"],
    ["status", "Status"], ["recordedBy", "Recorded By"],
  ],
  fields: [
    textField("reference", "Reference"),
    { key: "date", label: "Date", type: "date" },
    textField("customer", "Customer"),
    selectField("incomeType", "Income Type", ["Customer Payment", "Sales Income", "Other Income"], true),
    textField("account", "Account"),
    selectField("paymentMethod", "Payment Method", paymentMethods),
    amountField("amount", "Amount", true),
    { key: "description", label: "Description", type: "textarea" },
    { key: "remarks", label: "Remarks", type: "textarea" },
  ],
  filters: [
    ...dateFilters, textField("customer", "Customer"),
    selectField("incomeType", "Income Type", ["Customer Payment", "Sales Income", "Other Income"]),
    textField("account", "Account"),
    selectField("paymentMethod", "Payment Method", paymentMethods),
    selectField("status", "Status", statuses),
  ],
  searchKeys: ["reference", "customer", "incomeType", "account", "paymentMethod"],
  actions: ["view", "edit", "cancel"],
};

export const expensesConfig = {
  slug: "expenses",
  title: "Expenses",
  description: "Record and monitor company operating and production-related expenses.",
  emptyTitle: "No expense records available",
  addLabel: "Record Expense",
  recordName: "expense",
  columns: [
    ["reference", "Reference"], ["date", "Date"], ["category", "Category"],
    ["description", "Description"], ["account", "Account"],
    ["paymentMethod", "Payment Method"], ["amount", "Amount"],
    ["status", "Status"], ["recordedBy", "Recorded By"],
  ],
  fields: [
    textField("reference", "Reference"),
    { key: "date", label: "Date", type: "date", required: true },
    selectField("category", "Expense Category", ["Raw Materials", "Production", "Utilities", "Salaries", "Transport", "Maintenance", "Office", "Rent", "Other"], true),
    textField("account", "Account", true),
    selectField("paymentMethod", "Payment Method", paymentMethods),
    amountField("amount", "Amount", true),
    { key: "description", label: "Description", type: "textarea" },
    { key: "remarks", label: "Remarks", type: "textarea" },
    { key: "attachment", label: "Attachment", type: "file" },
  ],
  filters: [
    ...dateFilters,
    selectField("category", "Expense Category", ["Raw Materials", "Production", "Utilities", "Salaries", "Transport", "Maintenance", "Office", "Rent", "Other"]),
    textField("account", "Account"),
    selectField("paymentMethod", "Payment Method", paymentMethods),
    selectField("status", "Status", statuses),
  ],
  searchKeys: ["reference", "category", "description", "account", "paymentMethod"],
  actions: ["view", "edit", "cancel"],
};

export const invoicesConfig = {
  slug: "invoices",
  title: "Invoices",
  description: "Manage customer invoices, due dates and payment status.",
  emptyTitle: "No invoices available",
  addLabel: "Create Invoice",
  recordName: "invoice",
  invoice: true,
  columns: [
    ["number", "Invoice Number"], ["customer", "Customer"],
    ["invoiceDate", "Invoice Date"], ["dueDate", "Due Date"],
    ["total", "Total"], ["paid", "Paid"], ["balance", "Balance"], ["status", "Status"],
  ],
  fields: [
    textField("customer", "Customer", true),
    { key: "invoiceDate", label: "Invoice Date", type: "date", required: true },
    { key: "dueDate", label: "Due Date", type: "date", required: true },
    selectField("currency", "Currency", ["USD", "EUR", "GBP", "PKR"], true),
    textField("referenceOrder", "Reference Order"),
    { key: "description", label: "Description", type: "textarea" },
    amountField("tax", "Tax"),
    amountField("discount", "Discount"),
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  filters: [
    textField("customer", "Customer"),
    selectField("status", "Invoice Status", ["Draft", "Issued", "Partially Paid", "Paid", "Overdue", "Cancelled"]),
    ...dateFilters,
    { key: "dueDate", label: "Due date", type: "date" },
  ],
  searchKeys: ["number", "customer", "referenceOrder", "status"],
  actions: ["view", "edit", "issue", "payment", "cancel"],
};

export const paymentsConfig = {
  slug: "payments",
  title: "Payments",
  description: "Record and monitor customer and supplier payments.",
  emptyTitle: "No payment records available",
  addLabel: "Record Payment",
  recordName: "payment",
  columns: [
    ["reference", "Payment Reference"], ["date", "Date"], ["type", "Type"],
    ["party", "Customer/Supplier"], ["invoiceReference", "Invoice/Reference"],
    ["paymentMethod", "Payment Method"], ["amount", "Amount"],
    ["account", "Account"], ["status", "Status"],
  ],
  fields: [
    selectField("type", "Payment Type", ["Customer Payment", "Supplier Payment", "Refund", "Other"], true),
    { key: "date", label: "Date", type: "date", required: true },
    textField("party", "Customer/Supplier", true),
    textField("invoiceReference", "Invoice/Reference"),
    selectField("paymentMethod", "Payment Method", paymentMethods, true),
    textField("account", "Account", true),
    amountField("amount", "Amount", true),
    textField("reference", "Reference Number"),
    { key: "remarks", label: "Remarks", type: "textarea" },
  ],
  filters: [
    selectField("type", "Payment Type", ["Customer Payment", "Supplier Payment", "Refund", "Other"]),
    textField("party", "Customer/Supplier"),
    ...dateFilters,
    selectField("paymentMethod", "Payment Method", paymentMethods),
    selectField("status", "Status", statuses),
  ],
  searchKeys: ["reference", "type", "party", "invoiceReference", "paymentMethod"],
  actions: ["view", "edit", "cancel"],
};

export const receivablesConfig = {
  slug: "receivables",
  title: "Receivables",
  description: "Monitor outstanding customer balances and collection status.",
  emptyTitle: "No receivable records available",
  readOnly: true,
  kpis: ["Total Receivable", "Due", "Overdue", "Collected"],
  columns: [
    ["customer", "Customer"], ["invoice", "Invoice"], ["invoiceDate", "Invoice Date"],
    ["dueDate", "Due Date"], ["invoiceAmount", "Invoice Amount"], ["paid", "Paid"],
    ["outstanding", "Outstanding"], ["daysOutstanding", "Days Outstanding"],
    ["aging", "Aging"], ["status", "Status"],
  ],
  filters: [
    textField("customer", "Customer"),
    selectField("aging", "Aging", ["Current", "1–30 Days", "31–60 Days", "61–90 Days", "90+ Days"]),
    selectField("status", "Invoice Status", ["Issued", "Partially Paid", "Paid", "Overdue"]),
    ...dateFilters,
  ],
  searchKeys: ["customer", "invoice", "aging", "status"],
  actions: ["viewInvoice", "payment", "viewCustomer"],
};

export const payablesConfig = {
  slug: "payables",
  title: "Payables",
  description: "Monitor supplier obligations, due dates and outstanding payments.",
  emptyTitle: "No payable records available",
  readOnly: true,
  kpis: ["Total Payable", "Due", "Overdue", "Paid"],
  columns: [
    ["supplier", "Supplier"], ["bill", "Bill/Reference"], ["billDate", "Bill Date"],
    ["dueDate", "Due Date"], ["billAmount", "Bill Amount"], ["paid", "Paid"],
    ["outstanding", "Outstanding"], ["daysOutstanding", "Days Outstanding"],
    ["aging", "Aging"], ["status", "Status"],
  ],
  filters: [
    textField("supplier", "Supplier"),
    selectField("aging", "Aging", ["Current", "1–30 Days", "31–60 Days", "61–90 Days", "90+ Days"]),
    selectField("status", "Status", ["Due", "Partially Paid", "Paid", "Overdue"]),
    ...dateFilters,
  ],
  searchKeys: ["supplier", "bill", "aging", "status"],
  actions: ["view", "payment", "viewSupplier"],
};

export const cashBankConfig = {
  slug: "cash-bank",
  title: "Cash & Bank",
  description: "Manage cash accounts, bank accounts and financial movements.",
  emptyTitle: "No cash or bank accounts configured",
  addLabel: "Add Account",
  secondaryLabel: "Record Transaction",
  recordName: "cash/bank account",
  cashBank: true,
  columns: [
    ["name", "Account Name"], ["accountNumber", "Account Number / Reference"],
    ["bankName", "Bank"], ["type", "Account Type"], ["currency", "Currency"],
    ["openingBalance", "Opening Balance"], ["currentBalance", "Current Balance"], ["status", "Status"],
  ],
  fields: [
    textField("name", "Account Name", true),
    selectField("type", "Account Type", ["Cash", "Bank"], true),
    textField("bankName", "Bank Name"),
    textField("accountNumber", "Account Number"),
    selectField("currency", "Currency", ["USD", "EUR", "GBP", "PKR"], true),
    amountField("openingBalance", "Opening Balance"),
    { key: "description", label: "Description", type: "textarea" },
    selectField("status", "Status", ["Active", "Inactive"], true),
  ],
  transactionFields: [
    { key: "date", label: "Date", type: "date", required: true },
    textField("reference", "Reference"),
    selectField("type", "Transaction Type", ["Deposit", "Withdrawal", "Transfer", "Adjustment"], true),
    { key: "account", label: "Account", type: "accountSelect", required: true },
    amountField("amount", "Amount", true),
    textField("description", "Description"),
  ],
  transactionFilters: [
    ...dateFilters,
    selectField("account", "Account", []),
    selectField("type", "Transaction Type", ["Deposit", "Withdrawal", "Transfer", "Adjustment"]),
  ],
  filters: [
    selectField("type", "Account Type", ["Cash", "Bank"]),
    selectField("status", "Status", ["Active", "Inactive"]),
  ],
  searchKeys: ["name", "accountNumber", "bankName", "type"],
  actions: ["view", "edit", "toggle"],
};

export const transactionsConfig = {
  slug: "transactions",
  title: "Transactions",
  description: "View the complete financial transaction ledger.",
  emptyTitle: "No financial transactions available",
  readOnly: true,
  columns: [
    ["date", "Date"], ["reference", "Reference"], ["type", "Transaction Type"],
    ["account", "Account"], ["description", "Description"], ["debit", "Debit"],
    ["credit", "Credit"], ["balance", "Balance"], ["status", "Status"], ["createdBy", "Created By"],
  ],
  filters: [
    ...dateFilters, textField("account", "Account"),
    selectField("type", "Transaction Type", ["Income", "Expense", "Customer Payment", "Supplier Payment", "Transfer", "Adjustment", "Refund", "Other"]),
    textField("reference", "Reference"),
    selectField("status", "Status", ["Draft", "Posted", "Cancelled"]),
  ],
  searchKeys: ["reference", "type", "account", "description", "status"],
  actions: ["view", "source"],
};

export const reportsConfig = {
  slug: "reports",
  title: "Financial Reports",
  description: "Generate financial reports from connected accounting data.",
  report: true,
  fields: [
    selectField("type", "Report Type", ["Profit & Loss", "Balance Sheet", "Cash Flow", "Income Report", "Expense Report", "Receivables Aging", "Payables Aging", "Customer Statement", "Supplier Statement", "General Ledger", "Trial Balance"], true),
    ...dateFilters,
    textField("account", "Account"),
    textField("customer", "Customer"),
    textField("supplier", "Supplier"),
  ],
};
