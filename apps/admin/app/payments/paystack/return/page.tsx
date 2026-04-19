import { PaystackReturnClient } from "./PaystackReturnClient";

type PaystackReturnSearchParams = {
  reference?: string;
  trxref?: string;
  payment_ref?: string;
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

  return <PaystackReturnClient reference={reference} />;
}
