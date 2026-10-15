import PayrollPrintClient from "./PayrollPrintClient";

/* ?view=payslips prints one payslip per employee; otherwise the register. */
export default async function PrintPage({ params, searchParams }) {
  const { id } = await params;
  const { view, employee } = await searchParams;

  return <PayrollPrintClient id={id} view={view === "payslips" ? "payslips" : "register"} employeeId={employee ?? ""} />;
}

export const instant = false;
