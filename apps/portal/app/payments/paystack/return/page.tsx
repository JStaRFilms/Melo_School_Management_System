import { PaystackReturnClient } from "./PaystackReturnClient";

export default function PaystackReturnPage({
  searchParams,
}: {
  searchParams?: {
    reference?: string;
    trxref?: string;
    payment_ref?: string;
    studentId?: string;
  };
}) {
  const reference =
    searchParams?.reference ?? searchParams?.trxref ?? searchParams?.payment_ref ?? "";
  const returnHref = searchParams?.studentId
    ? `/billing?studentId=${encodeURIComponent(searchParams.studentId)}`
    : "/billing";

  return <PaystackReturnClient reference={reference} returnHref={returnHref} />;
}
