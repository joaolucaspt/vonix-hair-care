import { createServerFn } from "@tanstack/react-start";
import { cepInput, fetchAddress } from "./address.server";

export const lookupAddress = createServerFn({ method: "POST" })
  .inputValidator(cepInput)
  .handler(({ data }) => fetchAddress(data.cep));
