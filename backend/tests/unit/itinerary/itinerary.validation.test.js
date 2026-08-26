import {
  getItinerarySchema,
  listItinerariesSchema,
  saveItinerarySchema,
} from "../../../src/modules/itinerary/itinerary.validation.js";

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
});
