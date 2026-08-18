class ViewerMapper {

    toResponse({

        user,

        profile,

        identity

    }) {

        return {

            id: user.id,

            status: user.status,

            profile: {

                username: profile.username,

                displayName: profile.display_name,

                avatarUrl: profile.avatar_url,

                bio: profile.bio,

                countryCode: profile.country_code

            },

            identity: {

                provider: identity.provider,

                verified: identity.is_verified

            }

        };

    }

}

export default new ViewerMapper();