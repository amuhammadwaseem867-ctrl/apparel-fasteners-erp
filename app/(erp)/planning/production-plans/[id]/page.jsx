import PlanClient from "@/components/planning/PlanClient";

export default async function PlanPage({ params }) {
  const { id } = await params;
  return <PlanClient id={id} />;
}

export const instant = false;
