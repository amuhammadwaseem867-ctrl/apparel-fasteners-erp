import EditProductClient from "./EditProductClient";  export default async function EditProductPage({ params }) {   const { id } = await params;   return <EditProductClient id={id} />; }

export const instant = false;

