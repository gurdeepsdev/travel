import ProfileMapper from "../../../src/modules/users/mappers/profile.mapper.js";

describe("ProfileMapper toPublicResponse", () => {
  test('maps city and nested place coordinates, preserving zero and missing values',()=>{
    const result=ProfileMapper.toPublicResponse({preferred_visited_collections:[
      {id:'a',latitude:'27.1751',longitude:'78.0421',places:[{id:'p',latitude:'27.1',longitude:'78.1'}]},
      {id:'b',latitude:0,longitude:0,places:[{id:'q',latitude:0,longitude:0}]},
      {id:'c',places:[{id:'r'}]},
    ]});
    expect(result.preferredVisitedCollections[0]).toMatchObject({latitude:27.1751,longitude:78.0421,places:[{latitude:27.1,longitude:78.1}]});
    expect(result.preferredVisitedCollections[1]).toMatchObject({latitude:0,longitude:0,places:[{latitude:0,longitude:0}]});
    expect(result.preferredVisitedCollections[2]).toMatchObject({latitude:null,longitude:null,places:[{latitude:null,longitude:null}]});
  });
  test("includes the user ID and privacy state", () => {
    const result =
      ProfileMapper.toPublicResponse({
        user_id:
          "b3fe5214-e569-4300-8509-589785ad86f2",
        username:
          "user_98ef01e9",
        is_private:
          true,
      });

    expect(result).toMatchObject({
      userId:
        "b3fe5214-e569-4300-8509-589785ad86f2",
      username:
        "user_98ef01e9",
      shareUrl:
        "https://artictern.com/u/user_98ef01e9",
      shareprofile_url:
        "https://artictern.com/u/user_98ef01e9",
      relationship:
        null,
      isPrivate:
        true,
    });
  });

  test(
    "maps the viewer relationship state",
    () => {
      const result =
        ProfileMapper.toPublicResponse(
          {
            user_id:
              "b3fe5214-e569-4300-8509-589785ad86f2",

            username:
              "user_98ef01e9",

            is_private:
              false,
          },
          {
            status:
              "OUTGOING_PENDING",

            connectionId:
              null,

            requestId:
              "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
          },
        );

      expect(
        result.relationship,
      ).toEqual({
        status:
          "OUTGOING_PENDING",

        connectionId:
          null,

        requestId:
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      });
    },
  );

  test(
    "maps only the limited private profile preview",
    () => {
      const result =
        ProfileMapper.toPrivatePreview(
          {
            user_id:
              "b3fe5214-e569-4300-8509-589785ad86f2",

            username:
              "private_user",

            display_name:
              "Private User",

            bio:
              "must remain private",

            connections_count:
              "12",

            posts_count:
              7,

            visited_places_count:
              9,

            preferred_visited_collections:
              Array.from(
                { length: 6 },
                (_, index) => ({
                  id:
                    `collection-${index}`,

                  name:
                    `City ${index}`,

                  icon:
                    index === 0
                      ? {
                          id:
                            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",

                          storageProvider:
                            "local",

                          storageKey:
                            "cities/delhi.png",

                          mimeType:
                            "image/png",

                          isPublic:
                            true,
                        }
                      : null,

                  places: [
                    {
                      id:
                        `place-${index}`,

                      name:
                        `Place ${index}`,
                    },
                  ],
                }),
              ),
          },
          {
            status:
              "OUTGOING_PENDING",

            requestId:
              "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
          },
        );

      expect(result).toMatchObject({
        username:
          "private_user",

        displayName:
          "Private User",

        isPrivate:
          true,

        stats: {
          connections:
            12,

          posts:
            7,

          visitedPlaces:
            9,
        },

        relationship: {
          status:
            "OUTGOING_PENDING",
        },
      });

      expect(
        result.preferredVisitedCollections,
      ).toHaveLength(5);

      expect(
        result
          .preferredVisitedCollections[0]
          .icon,
      ).toEqual({
        id:
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",

        url:
          "/api/v1/media/assets/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/content",

        mimeType:
          "image/png",
      });

      expect(result).not.toHaveProperty(
        "bio",
      );

      expect(result).not.toHaveProperty(
        "socialLinks",
      );
    },
  );

  test(
    "includes the share URL in the authenticated profile response",
    () => {
      const result =
        ProfileMapper.toResponse({
          user_id:
            "b3fe5214-e569-4300-8509-589785ad86f2",
          username:
            "user_98ef01e9",
          is_private:
            false,
        });

      expect(result.shareprofile_url)
        .toBe(
          "https://artictern.com/u/user_98ef01e9",
        );
    },
  );
});
