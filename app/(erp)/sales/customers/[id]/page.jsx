import CustomerProfileClient from "./CustomerProfileClient";

export default async function CustomerPage({ params }) {
  const { id } = await params;

  return <CustomerProfileClient id={id} />;
}

export const instant = false;
