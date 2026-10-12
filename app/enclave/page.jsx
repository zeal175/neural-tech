import { redirect } from "next/navigation";

const ENCLAVE_URL = process.env.NEXT_PUBLIC_ENCLAVE_URL || "http://localhost:3001";

export default function Enclave() {
  redirect(ENCLAVE_URL);
}
