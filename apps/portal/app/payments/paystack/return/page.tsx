import { PaystackReturnClient } from "./PaystackReturnClient";

type PaystackReturnSearchParams = {
  reference?: string;
  trxref?: string;
  payment_ref?: string;
  studentId?: string;
};

export default async function PaystackReturnPage({
  searchParams,
}: {
  searchParams?: Promise<PaystackReturnSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const reference =
    resolvedSearchParams?.reference ??
    resolvedSearchParams?.trxref ??
    resolvedSearchParams?.payment_ref ??
    "";
  const returnHref = resolvedSearchParams?.studentId
    ? `/billing?studentId=${encodeURIComponent(resolvedSearchParams.studentId)}`
    : "/billing";

  return <PaystackReturnClient reference={reference} returnHref={returnHref} />;
}
