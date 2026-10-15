import PayrollRunClient from "./PayrollRunClient";

export default async function PayrollRunPage({ params }) {
  const { id } = await params;

  return <PayrollRunClient id={id} />;
}

export const instant = false;
