import crypto from "crypto";

import UsersRepository from "../repositories/users.repository.js";
import IdentitiesRepository from "../repositories/identities.repository.js";
import ProfilesRepository from "../../users/repositories/profiles.repository.js";



class IdentityService {

    async resolve({

        provider,

        identifier

    }) {

        const identity = await IdentitiesRepository.findByProvider(

            provider,

            identifier

        );

        if (identity) {

            return UsersRepository.findById(identity.user_id);

        }

        const user = await UsersRepository.create();

        await IdentitiesRepository.create({

            userId: user.id,

            provider,

            identifier

        });

        const username =
            `user_${crypto.randomBytes(4).toString("hex")}`;

        await ProfilesRepository.create({

            userId: user.id,

            username

        });

        return user;

    }

    async resolveByUserId(userId) {

        const identity = await IdentitiesRepository.findOne(
    
            "user_id = $1 AND is_primary = true",
    
            [
    
                userId
    
            ]
    
        );
    
        if (!identity) {
    
            throw new Error("Identity not found.");
    
        }
    
        const user = await UsersRepository.findById(
    
            userId
    
        );
    
        const profile = await ProfilesRepository.findByUserId(
    
            userId
    
        );
    
        return {
    
            user,
    
            profile,
    
            identity
    
        };
    
    }

}

export default new IdentityService();