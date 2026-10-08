import OrderProfileClient from "./OrderProfileClient";  export default async function OrderProfilePage({ params }) {   const { id } = await params;   return <OrderProfileClient id={id} />; }

export const instant = false;

