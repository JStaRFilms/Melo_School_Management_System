import { PaystackReturnClient } from "./PaystackReturnClient";

export default function PaystackReturnPage({
  searchParams,
}: {
  searchParams?: {
    reference?: string;
    trxref?: string;
    payment_ref?: string;
  };
}) {
  const reference =
    searchParams?.reference ?? searchParams?.trxref ?? searchParams?.payment_ref ?? "";

  return <PaystackReturnClient reference={reference} />;
}
