import InspectionClient from "./InspectionClient";

export default async function InspectionPage({ params }) {
  const { id } = await params;

  return <InspectionClient id={id} />;
}

export const instant = false;
