import EditOrderClient from "./EditOrderClient";  export default async function EditOrderPage({ params }) {   const { id } = await params;   return <EditOrderClient id={id} />; }

export const instant = false;

