import { describe, expect, it } from "vitest";
import { isOrderPaidEvent, normalizeEvent, parseAppmaxWebhook } from "@/lib/appmax-event";
import {
  buildCartBody,
  hasOrderTag,
  orderTag,
  parsePaidOrder,
  pickService,
  volumeFor,
  type Sender,
} from "@/lib/shipping-label";

/** Aviso "Pedido pago" real do Appmax (pedido de teste 132469895), sem o QR code do Pix. */
const real = {
  event: "OrderPaid",
  environment: "production",
  data: {
    id: 132469895,
    total: 15.8,
    status: "aprovado",
    paid_at: "2026-11-10 15:20:57",
    bundles: [
      {
        id: 39108868,
        name: "1x Perfume Capilar Vonix (Rubi 60ml)",
        products: [
          {
            id: 35794093,
            sku: "perfume-capilar-vonix",
            name: "1x Perfume Capilar Vonix (Rubi 60ml)",
            price: "1.00",
            quantity: 1,
          },
        ],
      },
    ],
    customer: {
      id: 143483051,
      uf: "MG",
      email: "cliente@example.com",
      fullname: "Lucas Silva",
      postcode: "33933644",
      telephone: "31991439228",
      address_city: "Ribeirão das Neves",
      address_state: "MG",
      address_street: "R. Francisca Antonia Gonçalves",
      document_number: "12203373660",
      address_street_number: "83",
      address_street_district: "Fluminense",
      address_street_complement: "b",
    },
    company_cnpj: "68272005000107",
    freight_type: "PAC",
    freight_value: 14.94,
  },
};

const sender: Sender = {
  name: "Vonix Hair",
  email: "loja@example.com",
  phone: "31971185662",
  cnpj: "68272005000107",
  address: "Rua José Pedro De Carvalho",
  number: "30",
  complement: "Indústria",
  district: "São João Batista",
  city: "Santa Luzia",
  state: "MG",
  postcode: "33030810",
};
const unit = { width: 16, height: 12, length: 22, weight: 0.6 };
const q = (id: number, name: string, price: number, days = 4) => ({
  id,
  name,
  company: "x",
  price,
  days,
});

describe("aviso do Appmax", () => {
  it('"OrderPaid" vira order_paid e o número vem de data.id', () => {
    expect(normalizeEvent("OrderPaid")).toBe("order_paid");
    expect(normalizeEvent("order_paid")).toBe("order_paid");
    const hook = parseAppmaxWebhook(real);
    expect(hook?.event).toBe("order_paid");
    expect(hook?.orderId).toBe(132469895);
    expect(isOrderPaidEvent(hook?.event ?? "")).toBe(true);
  });

  it("aceita o formato antigo data.order_id e rejeita corpos inválidos", () => {
    expect(parseAppmaxWebhook({ event: "order_paid", data: { order_id: 7 } })?.orderId).toBe(7);
    expect(parseAppmaxWebhook({ event: "OrderPaid", data: {} })).toBeNull();
    expect(parseAppmaxWebhook({ data: { id: 1 } })).toBeNull();
    expect(parseAppmaxWebhook("x")).toBeNull();
  });

  it("só 'Pedido pago' libera etiqueta (aprovado e Pix pago chegam juntos)", () => {
    expect(isOrderPaidEvent(normalizeEvent("OrderApproved"))).toBe(false);
    expect(isOrderPaidEvent(normalizeEvent("PixPaid"))).toBe(false);
  });
});

describe("pedido pago", () => {
  it("lê endereço, itens e unidades do aviso real", () => {
    const o = parsePaidOrder(real.data);
    expect(o?.id).toBe(132469895);
    expect(o?.customer).toMatchObject({
      name: "Lucas Silva",
      postcode: "33933644",
      state: "MG",
      document: "12203373660",
      number: "83",
      district: "Fluminense",
    });
    expect(o?.units).toBe(1);
    expect(o?.productsTotal).toBe(1);
    expect(o?.sellerCnpj).toBe("68272005000107");
  });

  it('"2x" no nome conta duas unidades', () => {
    const o = parsePaidOrder({
      ...real.data,
      bundles: [{ products: [{ name: "2x Kit Banana e Mel", price: "199.80", quantity: 1 }] }],
    });
    expect(o?.units).toBe(2);
  });

  it("recusa pedido sem CEP, rua ou CPF válidos", () => {
    expect(
      parsePaidOrder({ ...real.data, customer: { ...real.data.customer, postcode: "123" } }),
    ).toBeNull();
    expect(
      parsePaidOrder({ ...real.data, customer: { ...real.data.customer, address_street: "" } }),
    ).toBeNull();
    expect(
      parsePaidOrder({ ...real.data, customer: { ...real.data.customer, document_number: "12" } }),
    ).toBeNull();
    expect(parsePaidOrder({ ...real.data, bundles: [] })).toBeNull();
  });
});

describe("serviço de frete", () => {
  const quotes = [
    q(1, "PAC", 14.94),
    q(2, "SEDEX", 29.9, 2),
    q(3, "Standard", 14.94, 5),
    q(4, ".Package", 19.5),
  ];

  it("o preço pago manda; o nome só desempata", () => {
    expect(pickService(quotes, "PAC", 14.94)?.id).toBe(1);
    expect(pickService(quotes, "Standard", 14.94)?.id).toBe(3);
  });

  it("não confia no freight_type quando o preço aponta outro serviço", () => {
    expect(pickService(quotes, "PAC", 29.9)?.id).toBe(2);
  });

  it("usa o mais próximo quando o preço mudou um pouco", () => {
    expect(pickService(quotes, "PAC", 15.1)?.id).toBe(1);
  });

  it("frete grátis escolhe a opção grátis do checkout", () => {
    expect(pickService([q(1, "PAC", 20, 6), q(2, "SEDEX", 30, 2)], "PAC", 0)?.id).toBeDefined();
    expect(pickService([], "PAC", 14.94)).toBeUndefined();
  });
});

describe("envio no Melhor Envio", () => {
  const order = parsePaidOrder(real.data)!;

  it("monta remetente, destinatário, volume e a tag do pedido", () => {
    const b = buildCartBody(order, 1, sender, unit, true);
    expect(b.service).toBe(1);
    expect(b.from).toMatchObject({
      company_document: "68272005000107",
      document: "",
      postal_code: "33030810",
      state_abbr: "MG",
      country_id: "BR",
    });
    expect(b.to).toMatchObject({
      name: "Lucas Silva",
      document: "12203373660",
      company_document: "",
      postal_code: "33933644",
      number: "83",
    });
    expect(b.products).toEqual([
      { name: "1x Perfume Capilar Vonix (Rubi 60ml)", quantity: "1", unitary_value: "1.00" },
    ]);
    expect(b.volumes).toEqual([{ width: 16, length: 22, height: 12, weight: 0.6 }]);
    expect(b.options).toMatchObject({
      non_commercial: true,
      insurance_value: 1,
      tags: [{ tag: "appmax-132469895", url: null }],
    });
  });

  it("CNPJ do cliente vai em company_document", () => {
    const b = buildCartBody(
      { ...order, customer: { ...order.customer, document: "68272005000107" } },
      1,
      sender,
      unit,
      true,
    );
    expect(b.to).toMatchObject({ document: "", company_document: "68272005000107" });
  });

  it("um pacote só, que cresce com as unidades", () => {
    expect(volumeFor(3, unit)).toEqual({ width: 16, length: 22, height: 36, weight: 1.8 });
  });

  it("reconhece o envio já criado pela tag, em texto ou objeto", () => {
    expect(orderTag(132469895)).toBe("appmax-132469895");
    expect(hasOrderTag({ tags: [{ tag: "appmax-132469895", url: null }] }, 132469895)).toBe(true);
    expect(hasOrderTag({ tags: ["appmax-132469895"] }, 132469895)).toBe(true);
    expect(hasOrderTag({ tags: [{ tag: "appmax-1" }] }, 132469895)).toBe(false);
    expect(hasOrderTag({}, 132469895)).toBe(false);
  });
});
