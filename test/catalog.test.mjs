import assert from "node:assert/strict";
import { test } from "node:test";
import { readCatalog, validateCatalog } from "../scripts/check-catalog.mjs";

const catalog = await readCatalog();
const mutate = (change) => {
  const copy = structuredClone(catalog);
  change(copy);
  return validateCatalog(copy);
};

test("the researched pilot passes the data contract", () => {
  assert.deepEqual(validateCatalog(catalog), []);
});

test("malformed collection shapes report validation errors instead of crashing", () => {
  for (const group of ["projects", "products", "relationships"]) {
    assert.ok(
      mutate((data) => {
        data[group] = {};
      }).some((error) => error.includes(`${group} must be a nonempty array`)),
    );
  }
});

test("dangling relationship references and duplicate pairs are rejected", () => {
  assert.ok(
    mutate((data) => {
      data.relationships[0].productId = "missing-product";
    }).some((error) => error.includes("unknown product")),
  );
  assert.ok(
    mutate((data) => {
      data.relationships.push({ ...data.relationships[0], id: "duplicate-pair" });
    }).some((error) => error.includes("duplicate project/product pair")),
  );
});

test("duplicate IDs and invalid verification dates are rejected", () => {
  assert.ok(
    mutate((data) => {
      data.projects[1].id = data.projects[0].id;
    }).some((error) => error.includes("duplicate id")),
  );
  assert.ok(
    mutate((data) => {
      data.reviewedOn = "2026-02-30";
    }).some((error) => error.includes("valid ISO calendar date")),
  );
});

test("an unknown quote or usage bill cannot become a zero-price result", () => {
  for (const productId of ["notion", "firebase"]) {
    const errors = mutate((data) => {
      data.products
        .find((product) => product.id === productId)
        .pricing.find((price) => price.amount === null).amount = 0;
    });
    assert.ok(errors.some((error) => error.includes("must use null")));
  }
});

test("an incomplete billing observation cannot be silently marked verified", () => {
  assert.ok(
    mutate((data) => {
      data.products[0].pricing[0].verification = "verified";
    }).some((error) => error.includes("unknown billing cannot be verified")),
  );
});

test("missing evidence or scope cannot pass validation", () => {
  assert.ok(
    mutate((data) => {
      data.projects[0].license.scope = "";
    }).some((error) => error.includes("scoped license")),
  );
  assert.ok(
    mutate((data) => {
      data.relationships[0].evidenceUrls = [];
    }).some((error) => error.includes("evidence URLs")),
  );
});

test("unreviewed source availability stays a candidate", () => {
  assert.ok(
    mutate((data) => {
      data.products[0].sourceAvailability.classification = "proprietary-hosted-service";
    }).some((error) => error.includes("must remain a candidate")),
  );
});

test("conflicting official price observations cannot be marked verified", () => {
  assert.ok(
    mutate((data) => {
      data.products.find((product) => product.id === "uptimerobot").pricing[0].verification =
        "verified";
    }).some((error) => error.includes("conflicting observations require review")),
  );
});

test("mixed research batches retain individual valid review dates", () => {
  assert.ok(
    mutate((data) => {
      delete data.products[0].pricing[0].reviewedOn;
    }).some((error) => error.includes("valid ISO calendar date")),
  );
  assert.ok(
    mutate((data) => {
      data.relationships[0].reviewedOn = "2099-01-01";
    }).some((error) => error.includes("exceeds catalog review date")),
  );
  assert.ok(
    mutate((data) => {
      data.products[0].sourceAvailability.reviewedOn = "2026-02-30";
    }).some((error) => error.includes("valid ISO calendar date")),
  );
});

test("an ambiguous currency observation cannot enter verified pricing", () => {
  assert.ok(
    mutate((data) => {
      const price = data.products.find((product) => product.id === "sketch").pricing[0];
      price.verification = "verified";
    }).some((error) => error.includes("confirmed currency")),
  );
});

test("a failed price extraction is neither a verified price nor a zero-price offer", () => {
  assert.ok(
    mutate((data) => {
      data.products.find((product) => product.id === "pingdom").pricing[0].verification =
        "verified";
    }).some((error) => error.includes("unavailable price must remain unverified")),
  );
  assert.ok(
    mutate((data) => {
      data.products.find((product) => product.id === "pingdom").pricing[0].amount = 0;
    }).some((error) => error.includes("must use null")),
  );
});

test("supplemental currency sources cannot contain embedded credentials", () => {
  assert.ok(
    mutate((data) => {
      data.products[0].pricing[0].currencyEvidenceUrl = "https://user:password@example.com/";
    }).some((error) => error.includes("invalid currency evidence URL")),
  );
});

test("discovery provenance rejects malformed and repeated evidence IDs", () => {
  for (const ids of [["not-an-evidence-id"], ["a".repeat(64), "a".repeat(64)]]) {
    assert.ok(
      mutate((data) => {
        data.relationships[0].discoveryEvidenceIds = ids;
      }).some((error) => error.includes("invalid discovery evidence IDs")),
    );
  }
});
