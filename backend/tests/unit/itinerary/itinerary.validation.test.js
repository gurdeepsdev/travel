import {
  getItinerarySchema,
  listItinerariesSchema,
  saveItinerarySchema,
  updateItineraryStatusSchema,
  uploadVaultDocumentSchema,
  listVaultDocumentsSchema,
  updateItinerarySchema,
  updateItineraryNameSchema,
} from "../../../src/modules/itinerary/itinerary.validation.js";

describe("updateItineraryNameSchema", () => {
  const params = {
    itineraryId:
      "11111111-1111-4111-8111-111111111111",
  };

  test("accepts a trimmed itinerary name", () => {
    const result =
      updateItineraryNameSchema.safeParse({
        body: {
          name: "  Himachal Adventure  ",
        },
        params,
        query: {},
      });

    expect(result.success).toBe(true);
    expect(result.data.body.name)
      .toBe("Himachal Adventure");
  });

  test("rejects an empty itinerary name", () => {
    const result =
      updateItineraryNameSchema.safeParse({
        body: { name: "   " },
        params,
        query: {},
      });

    expect(result.success).toBe(false);
  });
});

describe("updateItinerarySchema", () => {
  test("accepts a complete replacement payload", () => {
    const result = updateItinerarySchema.safeParse({
      body: createPayload(),
      params: {
        itineraryId:
          "11111111-1111-4111-8111-111111111111",
      },
      query: {},
    });

    expect(result.success).toBe(true);
  });

  test("rejects a partial payload", () => {
    const result = updateItinerarySchema.safeParse({
      body: { city_id: "delhi" },
      params: {
        itineraryId:
          "11111111-1111-4111-8111-111111111111",
      },
      query: {},
    });

    expect(result.success).toBe(false);
  });
});

describe("itinerary vault validation", () => {
  const itineraryId =
    "11111111-1111-4111-8111-111111111111";

  test("accepts vault document metadata", () => {
    const result =
      uploadVaultDocumentSchema
        .safeParse({
          body: {
            documentType: "PASSPORT",
            title: "My passport",
            issueDate: "2025-01-01",
            expiryDate: "2035-01-01",
          },
          params: { itineraryId },
          query: {},
        });
    expect(result.success).toBe(true);
  });

  test("rejects reversed document dates", () => {
    const result =
      uploadVaultDocumentSchema
        .safeParse({
          body: {
            documentType: "VISA",
            title: "Visa",
            issueDate: "2030-01-01",
            expiryDate: "2029-01-01",
          },
          params: { itineraryId },
          query: {},
        });
    expect(result.success).toBe(false);
  });

  test("accepts a document type filter", () => {
    const result =
      listVaultDocumentsSchema
        .safeParse({
          body: undefined,
          params: { itineraryId },
          query: {
            documentType: "INSURANCE",
          },
        });
    expect(result.success).toBe(true);
  });
});

describe("updateItineraryStatusSchema", () => {
  test.each([
    "UPCOMING",
    "LIVE",
    "COMPLETED",
  ])(
    "accepts %s",
    (status) => {
      const result =
        updateItineraryStatusSchema
          .safeParse({
            body: { status },
            params: {
              itineraryId:
                "11111111-1111-4111-8111-111111111111",
            },
            query: {},
          });

      expect(result.success)
        .toBe(true);
    },
  );

  test("rejects unsupported statuses", () => {
    const result =
      updateItineraryStatusSchema
        .safeParse({
          body: {
            status: "PLANNED",
          },
          params: {
            itineraryId:
              "11111111-1111-4111-8111-111111111111",
          },
          query: {},
        });

    expect(result.success)
      .toBe(false);
  });
});

function createPayload() {
  return {
    request_id:
      "519e8514-6a00-43ac-b1e3-78277698f13a",
    status: "success",
    mode: "future",
    city_id: "delhi",
    summary: {
      num_days: 1,
      total_places: 1,
    },
    days: [
      {
        day: 1,
        items: [
          {
            item_type: "poi",
            place_id:
              "ChIJC03rqdriDDkRXT6SJRGXFwc",
          },
        ],
      },
    ],
  };
}

describe("saveItinerarySchema", () => {
  test(
    "accepts the generated itinerary payload",
    () => {
      const result =
        saveItinerarySchema.safeParse({
          body: createPayload(),
          params: {},
          query: {},
        });

      expect(result.success)
        .toBe(true);
    },
  );

  test(
    "rejects a mismatched summary day count",
    () => {
      const payload =
        createPayload();

      payload.summary.num_days = 2;

      const result =
        saveItinerarySchema.safeParse({
          body: payload,
          params: {},
          query: {},
        });

      expect(result.success)
        .toBe(false);
    },
  );
});

describe("getItinerarySchema", () => {
  test(
    "accepts a UUID itinerary ID",
    () => {
      const result =
        getItinerarySchema.safeParse({
          body: undefined,
          params: {
            itineraryId:
              "11111111-1111-4111-8111-111111111111",
          },
          query: {},
        });

      expect(result.success)
        .toBe(true);
    },
  );

  test(
    "rejects an invalid itinerary ID",
    () => {
      const result =
        getItinerarySchema.safeParse({
          body: undefined,
          params: {
            itineraryId:
              "not-a-uuid",
          },
          query: {},
        });

      expect(result.success)
        .toBe(false);
    },
  );
});

describe("listItinerariesSchema", () => {
  test(
    "applies the default page limit",
    () => {
      const result =
        listItinerariesSchema.safeParse({
          body: undefined,
          params: {},
          query: {},
        });

      expect(result.success)
        .toBe(true);
      expect(result.data.query.limit)
        .toBe(20);
    },
  );

  test(
    "rejects an excessive page limit",
    () => {
      const result =
        listItinerariesSchema.safeParse({
          body: undefined,
          params: {},
          query: {
            limit: "51",
          },
        });

      expect(result.success)
        .toBe(false);
    },
  );

  test(
    "accepts the planned status filter",
    () => {
      const result =
        listItinerariesSchema.safeParse({
          body: undefined,
          params: {},
          query: {
            status: "PLANNED",
          },
        });

      expect(result.success)
        .toBe(true);
      expect(result.data.query.status)
        .toBe("PLANNED");
    },
  );

  test(
    "accepts active itinerary status filters",
    () => {
      for (const status of [
        "UPCOMING",
        "LIVE",
        "COMPLETED",
      ]) {
        const result =
          listItinerariesSchema.safeParse({
            body: undefined,
            params: {},
            query: { status },
          });

        expect(result.success)
          .toBe(true);
      }
    },
  );

  test(
    "rejects unsupported list statuses",
    () => {
      const result =
        listItinerariesSchema.safeParse({
          body: undefined,
          params: {},
          query: {
            status: "CANCELLED",
          },
        });

      expect(result.success)
        .toBe(false);
    },
  );
});
