import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { lookupAddress } from "@/lib/address.functions";

/** A changed CEP cancels application of all previous results, including failures. */
export function useCepAddress(
  cep: string,
  onAddress: (
    address: { street: string; district: string; city: string; uf: string },
    lookedUpCep: string,
  ) => void,
) {
  const lookup = useServerFn(lookupAddress);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const digits = cep.replace(/\D/g, "");
    setMessage(null);
    setFailed(false);
    setLoading(false);
    if (digits.length !== 8) return;
    setLoading(true);
    // The carrier quote is independent; address lookup cannot leave the
    // buyer waiting indefinitely or overwrite their manual entry later.
    const deadline = window.setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      setLoading(false);
      setFailed(true);
      setMessage(
        "Não foi possível confirmar o endereço pelo CEP. Preencha manualmente ou tente buscar novamente.",
      );
    }, 10000);
    lookup({ data: { cep: digits } })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          onAddress(result.address, digits);
          const streetMissing = !result.address.street.trim();
          const districtMissing = !result.address.district.trim();
          if (streetMissing && districtMissing)
            setMessage("CEP localizado — preencha rua, bairro e número.");
          else if (streetMissing) setMessage("CEP localizado — preencha rua e número.");
          else if (districtMissing) setMessage("CEP localizado — preencha bairro e número.");
          else setMessage("Endereço preenchido — confira e complete o número.");
        } else {
          setFailed(true);
          setMessage(result.message);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setMessage(
            "Não foi possível buscar o endereço agora. Preencha manualmente; o frete continua independente.",
          );
        }
      })
      .finally(() => {
        window.clearTimeout(deadline);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(deadline);
    };
  }, [cep, lookup, onAddress, retry]);
  return { loading, message, failed, retry: () => setRetry((previous) => previous + 1) };
}
