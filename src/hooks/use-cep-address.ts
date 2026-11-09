import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { lookupAddress } from "@/lib/address.functions";

/** A changed CEP cancels application of all previous results, including failures. */
export function useCepAddress(
  cep: string,
  onAddress: (address: { street: string; district: string; city: string; uf: string }) => void,
) {
  const lookup = useServerFn(lookupAddress);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const digits = cep.replace(/\D/g, "");
    setMessage(null);
    setLoading(false);
    if (digits.length !== 8) return;
    setLoading(true);
    lookup({ data: { cep: digits } })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          onAddress(result.address);
          setMessage("Endereço preenchido — confira e complete o número.");
        } else setMessage(result.message);
      })
      .catch(() => {
        if (!cancelled)
          setMessage(
            "Não foi possível buscar o endereço agora. Preencha manualmente; o frete continua independente.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cep, lookup, onAddress]);
  return { loading, message };
}
