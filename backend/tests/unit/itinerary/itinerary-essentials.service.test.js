import { jest } from "@jest/globals";

const repositoryMock = {
  findOwnedItineraryTrip: jest.fn(),
  create: jest.fn(),
  listOwned: jest.fn(),
  updateOwned: jest.fn(),
  setSelectionOwned: jest.fn(),
  deleteOwned: jest.fn(),
};

jest.unstable_mockModule(
  "../../../src/modules/itinerary/itinerary-essentials.repository.js",
  () => ({ default: repositoryMock }),
);

const { default: service } = await import(
  "../../../src/modules/itinerary/itinerary-essentials.service.js"
);

const itineraryId =
  "11111111-1111-4111-8111-111111111111";
const tripId =
  "22222222-2222-4222-8222-222222222222";
const essentialId =
  "33333333-3333-4333-8333-333333333333";
const userId =
  "63aae149-8f8f-4b30-b30d-211da764c080";

function createEssential(
  overrides = {},
) {
  return {
    id: essentialId,
    trip_id: tripId,
    owner_id: userId,
    title: "Phone charger",
    category: "ELECTRONICS",
    is_completed: false,
    display_order: 1,
    created_at:
      "2026-09-09T08:00:00.000Z",
    updated_at:
      "2026-09-09T08:00:00.000Z",
    ...overrides,
  };
}

describe("ItineraryEssentialsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repositoryMock
      .findOwnedItineraryTrip
      .mockResolvedValue({
        itinerary_id: itineraryId,
        trip_id: tripId,
      });
  });

  test("creates an essential for an owned trip", async () => {
    repositoryMock.create
      .mockResolvedValue(
        createEssential(),
      );

    const input = {
      title: "Phone charger",
      category: "ELECTRONICS",
      displayOrder: 1,
    };
    const result =
      await service.createEssential({
        itineraryId,
        userId,
        input,
      });

    expect(repositoryMock.create)
      .toHaveBeenCalledWith({
        tripId,
        userId,
        input,
      });
    expect(result.essential)
      .toMatchObject({
        id: essentialId,
        selected: false,
      });
  });

  test("lists essentials with completion summary", async () => {
    repositoryMock.listOwned
      .mockResolvedValue([
        createEssential({
          is_completed: true,
        }),
        createEssential({
          id:
            "44444444-4444-4444-8444-444444444444",
          title: "Passport",
          category: "DOCUMENT",
        }),
      ]);

    const result =
      await service.listEssentials({
        itineraryId,
        userId,
      });

    expect(result.summary).toEqual({
      totalCount: 2,
      markedCount: 1,
      unmarkedCount: 1,
      completionPercentage: 50,
    });
  });

  test("updates essential fields", async () => {
    repositoryMock.updateOwned
      .mockResolvedValue(
        createEssential({
          title: "USB-C charger",
        }),
      );

    const result =
      await service.updateEssential({
        itineraryId,
        essentialId,
        userId,
        input: {
          title: "USB-C charger",
        },
      });

    expect(result.essential.title)
      .toBe("USB-C charger");
  });

  test.each([true, false])(
    "sets selected to %s",
    async (selected) => {
      repositoryMock.setSelectionOwned
        .mockResolvedValue(
          createEssential({
            is_completed: selected,
          }),
        );

      const result =
        await service
          .setEssentialSelection({
            itineraryId,
            essentialId,
            userId,
            selected,
          });

      expect(result.essential.selected)
        .toBe(selected);
    },
  );

  test("deletes an owned essential", async () => {
    repositoryMock.deleteOwned
      .mockResolvedValue({
        id: essentialId,
      });

    await expect(
      service.deleteEssential({
        itineraryId,
        essentialId,
        userId,
      }),
    ).resolves.toEqual({
      deleted: true,
      essentialId,
    });
  });

  test("requires a trip for create and list", async () => {
    repositoryMock
      .findOwnedItineraryTrip
      .mockResolvedValue({
        itinerary_id: itineraryId,
        trip_id: null,
      });

    await expect(
      service.listEssentials({
        itineraryId,
        userId,
      }),
    ).rejects.toMatchObject({
      code: "ITINERARY.TRIP_NOT_STARTED",
      statusCode: 409,
    });
  });

  test("hides missing and unowned essentials", async () => {
    repositoryMock.updateOwned
      .mockResolvedValue(null);

    await expect(
      service.updateEssential({
        itineraryId,
        essentialId,
        userId,
        input: { title: "Hidden" },
      }),
    ).rejects.toMatchObject({
      code: "ITINERARY.NOT_FOUND",
      statusCode: 404,
    });
  });
});
